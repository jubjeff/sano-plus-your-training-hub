import { requireSharedSecret } from "../_shared/auth.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
  EdgeHttpError,
  ensureMethod,
  getRequestId,
  normalizeEdgeError,
  parseJsonBody,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import {
  sendRenewalWarningEmail,
  sendCoachRenewalWarningEmail,
  sendSubscriptionExpiredEmail,
  sendAnamnesisReminder24hEmail,
  sendAnamnesisReminder72hEmail,
  sendMediaDeletionReminderEmail,
  sendMediaDeletedConfirmationEmail,
} from "../_shared/email.ts";

type AutomationJob =
  | "scan_overdue_students"
  | "build_coach_alerts"
  | "expire_trial_access"
  | "expire_subscriptions"
  | "send_renewal_warnings"
  | "send_coach_renewal_warnings"
  | "send_anamnesis_reminder_24h"
  | "send_anamnesis_reminder_72h"
  | "purge_expired_media"
  | "send_media_deletion_reminder";

type AutomationDispatchRequest = {
  job: AutomationJob;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
};

const supportedJobs = new Set<AutomationJob>([
  "scan_overdue_students",
  "build_coach_alerts",
  "expire_trial_access",
  "expire_subscriptions",
  "send_renewal_warnings",
  "send_coach_renewal_warnings",
  "send_anamnesis_reminder_24h",
  "send_anamnesis_reminder_72h",
  "purge_expired_media",
  "send_media_deletion_reminder",
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return createOptionsResponse();
  }

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    requireSharedSecret(request, "x-automation-secret", getEdgeRuntimeEnv().internalAutomationSecret);
    const serviceRoleClient = createServiceRoleClient();

    const body = await parseJsonBody<AutomationDispatchRequest>(request);
    if (!body.job || !supportedJobs.has(body.job)) {
      throw new EdgeHttpError("unsupported_job", "Job de automacao nao suportado.", 400, {
        supportedJobs: Array.from(supportedJobs),
      });
    }

    // ── scan_overdue_students ─────────────────────────────────────────────────
    if (body.job === "scan_overdue_students") {
      const threshold = new Date();
      threshold.setUTCDate(threshold.getUTCDate() - 3);
      const { data, error } = await serviceRoleClient
        .from("students")
        .select("id")
        .lte("payment_due_date", threshold.toISOString().slice(0, 10))
        .neq("proof_of_payment_status", "submitted");

      if (error) throw new EdgeHttpError("scan_overdue_students_failed", error.message, 400);

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        matchedStudents: data?.length ?? 0,
      });
    }

    // ── build_coach_alerts ────────────────────────────────────────────────────
    if (body.job === "build_coach_alerts") {
      const { data, error } = await serviceRoleClient
        .from("students")
        .select("teacher_id")
        .neq("status", "inactive");

      if (error) throw new EdgeHttpError("build_coach_alerts_failed", error.message, 400);

      const teacherIds = new Set((data ?? []).map((row) => String(row.teacher_id)));
      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        activeTeachers: teacherIds.size,
        activeStudents: data?.length ?? 0,
      });
    }

    // ── expire_trial_access ───────────────────────────────────────────────────
    if (body.job === "expire_trial_access") {
      const nowIso = new Date().toISOString();
      const { data, error } = await serviceRoleClient
        .from("teacher_subscriptions")
        .update({
          status: "expired",
          access_blocked: true,
          blocked_reason: "Trial expirado automaticamente.",
        })
        .eq("status", "trialing")
        .lte("trial_ends_at", nowIso)
        .select("id");

      if (error) throw new EdgeHttpError("expire_trial_access_failed", error.message, 400);

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        expiredSubscriptions: data?.length ?? 0,
      });
    }

    // ── expire_subscriptions ──────────────────────────────────────────────────
    if (body.job === "expire_subscriptions") {
      const env = getEdgeRuntimeEnv();
      const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");
      const today = new Date().toISOString().slice(0, 10);

      // Primeiro, busca as assinaturas que serão expiradas com dados do aluno
      const { data: toExpire, error: selectErr } = await serviceRoleClient
        .from("assinaturas")
        .select("id, planos(nome), aluno_id, anamnese_id")
        .eq("status", "ativo")
        .lt("data_renovacao", today);

      if (selectErr) throw new EdgeHttpError("expire_subscriptions_failed", selectErr.message, 400);

      if (!body.dryRun && toExpire && toExpire.length > 0) {
        // Expira todas de uma vez
        await serviceRoleClient
          .from("assinaturas")
          .update({ status: "expirado" })
          .eq("status", "ativo")
          .lt("data_renovacao", today);

        // Envia e-mail para cada aluno
        type ExpiredRow = {
          id: string;
          planos: { nome: string } | null;
          aluno_id: string | null;
          anamnese_id: string | null;
        };

        for (const row of toExpire as ExpiredRow[]) {
          const planName = row.planos?.nome ?? "Sano+";

          // Tenta buscar e-mail pelo students
          if (row.aluno_id) {
            const { data: student } = await serviceRoleClient
              .from("students")
              .select("full_name, email, teacher_id")
              .eq("id", row.aluno_id)
              .maybeSingle();

            if (student?.email) {
              // Busca nome do professor para assinar o e-mail
              let coachName: string | null = null;
              if (student.teacher_id) {
                const { data: teacher } = await serviceRoleClient
                  .from("teachers")
                  .select("user_id")
                  .eq("id", student.teacher_id)
                  .maybeSingle();
                if (teacher?.user_id) {
                  const { data: profile } = await serviceRoleClient
                    .from("profiles")
                    .select("full_name")
                    .eq("id", teacher.user_id)
                    .maybeSingle();
                  coachName = (profile?.full_name as string | null) ?? null;
                }
              }

              await sendSubscriptionExpiredEmail({
                email: student.email as string,
                studentName: student.full_name as string,
                planName,
                renewLink: `${appUrl}/planos`,
                coachName,
              }).catch(console.warn);
            }
            continue;
          }

          // Fallback: tenta pelo anamnese
          if (row.anamnese_id) {
            const { data: anamnese } = await serviceRoleClient
              .from("anamneses")
              .select("full_name, email, teacher_id")
              .eq("id", row.anamnese_id)
              .maybeSingle();

            if (anamnese?.email) {
              await sendSubscriptionExpiredEmail({
                email: anamnese.email as string,
                studentName: anamnese.full_name as string,
                planName,
                renewLink: `${appUrl}/planos`,
              }).catch(console.warn);
            }
          }
        }
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        expiredCount: toExpire?.length ?? 0,
      });
    }

    // ── send_renewal_warnings — aviso individual ao aluno 3 dias antes ────────
    if (body.job === "send_renewal_warnings") {
      const env = getEdgeRuntimeEnv();
      const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");
      const warningDate = new Date();
      warningDate.setUTCDate(warningDate.getUTCDate() + 3);
      const warningDateStr = warningDate.toISOString().slice(0, 10);

      const { data: pending, error: pendingErr } = await serviceRoleClient
        .from("assinaturas")
        .select("id, data_renovacao, aviso_vencimento_enviado_at, planos(nome), anamneses(full_name, email)")
        .eq("status", "ativo")
        .eq("data_renovacao", warningDateStr)
        .is("aviso_vencimento_enviado_at", null);

      if (pendingErr) throw new EdgeHttpError("send_renewal_warnings_failed", pendingErr.message, 400);

      type AssinaturaRow = {
        id: string;
        data_renovacao: string;
        planos: { nome: string } | null;
        anamneses: { full_name: string; email: string } | null;
      };

      const sent: string[] = [];
      for (const row of (pending ?? []) as AssinaturaRow[]) {
        const email = row.anamneses?.email;
        const name = row.anamneses?.full_name ?? "Aluno";
        const planName = row.planos?.nome ?? "Sano+";
        if (!email) continue;

        if (!body.dryRun) {
          await sendRenewalWarningEmail({
            email,
            studentName: name,
            planName,
            renewalDate: row.data_renovacao,
            renewLink: `${appUrl}/planos`,
          });

          await serviceRoleClient
            .from("assinaturas")
            .update({ aviso_vencimento_enviado_at: new Date().toISOString() })
            .eq("id", row.id);
        }

        sent.push(row.id);
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        warningsSent: sent.length,
      });
    }

    // ── send_coach_renewal_warnings — resumo ao professor (alunos vencendo) ───
    if (body.job === "send_coach_renewal_warnings") {
      const env = getEdgeRuntimeEnv();
      const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");
      const warningDate = new Date();
      warningDate.setUTCDate(warningDate.getUTCDate() + 3);
      const warningDateStr = warningDate.toISOString().slice(0, 10);

      // Busca assinaturas vencendo e agrupa por teacher
      const { data: pending, error: pendingErr } = await serviceRoleClient
        .from("assinaturas")
        .select("id, teacher_id, planos(nome), aluno_id, anamneses(full_name, email)")
        .eq("status", "ativo")
        .eq("data_renovacao", warningDateStr);

      if (pendingErr) throw new EdgeHttpError("send_coach_renewal_warnings_failed", pendingErr.message, 400);

      type RenewalRow = {
        id: string;
        teacher_id: string | null;
        planos: { nome: string } | null;
        aluno_id: string | null;
        anamneses: { full_name: string; email: string } | null;
      };

      // Resolve nome e e-mail de alunos via students quando anamnese não está disponível
      type StudentInfo = { name: string; email: string; planName: string };
      const byTeacher = new Map<string, StudentInfo[]>();

      for (const row of (pending ?? []) as RenewalRow[]) {
        if (!row.teacher_id) continue;

        let studentName = row.anamneses?.full_name ?? null;
        let studentEmail = row.anamneses?.email ?? null;

        if ((!studentName || !studentEmail) && row.aluno_id) {
          const { data: st } = await serviceRoleClient
            .from("students")
            .select("full_name, email")
            .eq("id", row.aluno_id)
            .maybeSingle();
          studentName = studentName ?? (st?.full_name as string | null) ?? "Aluno";
          studentEmail = studentEmail ?? (st?.email as string | null) ?? null;
        }

        if (!studentEmail) continue;

        const entry = byTeacher.get(row.teacher_id) ?? [];
        entry.push({ name: studentName ?? "Aluno", email: studentEmail, planName: row.planos?.nome ?? "Sano+" });
        byTeacher.set(row.teacher_id, entry);
      }

      const sent: string[] = [];
      for (const [teacherId, students] of byTeacher) {
        const { data: teacher } = await serviceRoleClient
          .from("teachers")
          .select("user_id")
          .eq("id", teacherId)
          .maybeSingle();
        if (!teacher?.user_id) continue;

        const { data: profile } = await serviceRoleClient
          .from("profiles")
          .select("email")
          .eq("id", teacher.user_id)
          .maybeSingle();
        if (!profile?.email) continue;

        if (!body.dryRun) {
          await sendCoachRenewalWarningEmail({
            coachEmail: profile.email as string,
            renewalDate: warningDateStr,
            students,
            dashboardLink: `${appUrl}/assinaturas`,
          }).catch(console.warn);
        }

        sent.push(teacherId);
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        coachesNotified: sent.length,
        totalStudents: [...byTeacher.values()].reduce((sum, arr) => sum + arr.length, 0),
      });
    }

    // ── send_anamnesis_reminder_24h ───────────────────────────────────────────
    // Alunos que enviaram a anamnese 24-48h atrás e ainda não têm assinatura ativa
    if (body.job === "send_anamnesis_reminder_24h") {
      const env = getEdgeRuntimeEnv();
      const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");
      const now = new Date();
      const from24h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const to24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const { data: anamneses, error } = await serviceRoleClient
        .from("anamneses")
        .select("id, full_name, email, teacher_id")
        .eq("status", "pending_review")
        .gte("created_at", from24h)
        .lte("created_at", to24h);

      if (error) throw new EdgeHttpError("send_anamnesis_reminder_24h_failed", error.message, 400);

      const sent: string[] = [];
      for (const row of (anamneses ?? []) as { id: string; full_name: string; email: string; teacher_id: string | null }[]) {
        // Verifica se já tem assinatura ativa ou pendente
        const { data: assinatura } = await serviceRoleClient
          .from("assinaturas")
          .select("id")
          .eq("anamnese_id", row.id)
          .in("status", ["ativo", "pendente"])
          .maybeSingle();

        if (assinatura?.id) continue;

        // Busca nome do professor
        let coachName: string | null = null;
        if (row.teacher_id) {
          const { data: teacher } = await serviceRoleClient
            .from("teachers").select("user_id").eq("id", row.teacher_id).maybeSingle();
          if (teacher?.user_id) {
            const { data: profile } = await serviceRoleClient
              .from("profiles").select("full_name").eq("id", teacher.user_id).maybeSingle();
            coachName = (profile?.full_name as string | null) ?? null;
          }
        }

        if (!body.dryRun) {
          await sendAnamnesisReminder24hEmail({
            fullName: row.full_name,
            email: row.email,
            anamnesisLink: `${appUrl}/planos`,
            coachName,
          }).catch(console.warn);
        }

        sent.push(row.id);
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        remindersSent: sent.length,
      });
    }

    // ── send_anamnesis_reminder_72h ───────────────────────────────────────────
    // Alunos que enviaram a anamnese 72-96h atrás e ainda não têm assinatura ativa
    if (body.job === "send_anamnesis_reminder_72h") {
      const env = getEdgeRuntimeEnv();
      const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");
      const now = new Date();
      const from72h = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();
      const to72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

      const { data: anamneses, error } = await serviceRoleClient
        .from("anamneses")
        .select("id, full_name, email, teacher_id")
        .eq("status", "pending_review")
        .gte("created_at", from72h)
        .lte("created_at", to72h);

      if (error) throw new EdgeHttpError("send_anamnesis_reminder_72h_failed", error.message, 400);

      const sent: string[] = [];
      for (const row of (anamneses ?? []) as { id: string; full_name: string; email: string; teacher_id: string | null }[]) {
        const { data: assinatura } = await serviceRoleClient
          .from("assinaturas")
          .select("id")
          .eq("anamnese_id", row.id)
          .in("status", ["ativo", "pendente"])
          .maybeSingle();

        if (assinatura?.id) continue;

        let coachName: string | null = null;
        if (row.teacher_id) {
          const { data: teacher } = await serviceRoleClient
            .from("teachers").select("user_id").eq("id", row.teacher_id).maybeSingle();
          if (teacher?.user_id) {
            const { data: profile } = await serviceRoleClient
              .from("profiles").select("full_name").eq("id", teacher.user_id).maybeSingle();
            coachName = (profile?.full_name as string | null) ?? null;
          }
        }

        if (!body.dryRun) {
          await sendAnamnesisReminder72hEmail({
            fullName: row.full_name,
            email: row.email,
            anamnesisLink: `${appUrl}/planos`,
            coachName,
          }).catch(console.warn);
        }

        sent.push(row.id);
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        remindersSent: sent.length,
      });
    }

    // ── purge_expired_media — roda todo dia às 03h00 ──────────────────────────
    // Deleta arquivos com media_expires_at <= agora e media_deletado = false
    if (body.job === "purge_expired_media") {
      const env = getEdgeRuntimeEnv();
      const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");
      const nowIso = new Date().toISOString();

      const { data: expired, error: expiredErr } = await serviceRoleClient
        .from("anamneses")
        .select(
          "id, full_name, teacher_id, " +
          "foto_frontal_url, foto_lateral_url, foto_posterior_url, " +
          "deep_squat_video_frontal_url, deep_squat_video_lateral_url, deep_squat_video_posterior_url",
        )
        .lte("media_expires_at", nowIso)
        .eq("media_deletado", false)
        .not("media_expires_at", "is", null);

      if (expiredErr) throw new EdgeHttpError("purge_expired_media_failed", expiredErr.message, 400);

      function extractPath(url: string | null, bucketName: string): string | null {
        if (!url) return null;
        const marker = `/object/public/${bucketName}/`;
        const idx = url.indexOf(marker);
        if (idx === -1) return null;
        return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
      }

      type ExpiredRow = {
        id: string;
        full_name: string;
        teacher_id: string | null;
        foto_frontal_url: string | null;
        foto_lateral_url: string | null;
        foto_posterior_url: string | null;
        deep_squat_video_frontal_url: string | null;
        deep_squat_video_lateral_url: string | null;
        deep_squat_video_posterior_url: string | null;
      };

      const deletedCount = { anamneses: 0, files: 0, errors: 0 };

      for (const row of (expired ?? []) as ExpiredRow[]) {
        const photoPaths = [
          extractPath(row.foto_frontal_url, "anamnesis-photos"),
          extractPath(row.foto_lateral_url, "anamnesis-photos"),
          extractPath(row.foto_posterior_url, "anamnesis-photos"),
        ].filter(Boolean) as string[];

        const videoPaths = [
          extractPath(row.deep_squat_video_frontal_url, "anamnesis-videos"),
          extractPath(row.deep_squat_video_lateral_url, "anamnesis-videos"),
          extractPath(row.deep_squat_video_posterior_url, "anamnesis-videos"),
        ].filter(Boolean) as string[];

        if (body.dryRun) {
          deletedCount.anamneses++;
          deletedCount.files += photoPaths.length + videoPaths.length;
          continue;
        }

        // Deleção atômica: só marca deletado após confirmar remoção do Storage
        let storageOk = true;

        if (photoPaths.length > 0) {
          const { error } = await serviceRoleClient.storage.from("anamnesis-photos").remove(photoPaths);
          if (error) { console.warn(`[purge] Erro ao deletar fotos de ${row.id}: ${error.message}`); storageOk = false; deletedCount.errors++; }
        }

        if (videoPaths.length > 0) {
          const { error } = await serviceRoleClient.storage.from("anamnesis-videos").remove(videoPaths);
          if (error) { console.warn(`[purge] Erro ao deletar vídeos de ${row.id}: ${error.message}`); storageOk = false; deletedCount.errors++; }
        }

        if (!storageOk) continue; // Tenta novamente no próximo ciclo

        // Marca deletado no banco e limpa URLs
        const deletedAt = new Date().toISOString();
        await serviceRoleClient.from("anamneses").update({
          media_deletado: true,
          media_deletado_em: deletedAt,
          foto_frontal_url: null,
          foto_lateral_url: null,
          foto_posterior_url: null,
          deep_squat_video_frontal_url: null,
          deep_squat_video_lateral_url: null,
          deep_squat_video_posterior_url: null,
        }).eq("id", row.id);

        deletedCount.anamneses++;
        deletedCount.files += photoPaths.length + videoPaths.length;

        // Notifica o professor
        if (row.teacher_id) {
          const { data: teacher } = await serviceRoleClient
            .from("teachers").select("user_id").eq("id", row.teacher_id).maybeSingle();
          if (teacher?.user_id) {
            const { data: profile } = await serviceRoleClient
              .from("profiles").select("email").eq("id", teacher.user_id).maybeSingle();
            if (profile?.email) {
              const filesDeleted: string[] = [];
              if (photoPaths.length > 0) filesDeleted.push("Foto frontal", "Foto lateral", "Foto posterior");
              if (videoPaths.length > 0) filesDeleted.push("Vídeo Deep Squat (frontal)", "Vídeo Deep Squat (lateral)", "Vídeo Deep Squat (posterior)");
              await sendMediaDeletedConfirmationEmail({
                coachEmail: profile.email as string,
                studentName: row.full_name,
                deletedAt,
                filesDeleted,
                panelLink: `${appUrl}/anamneses`,
              }).catch(console.warn);
            }
          }
        }
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        expiredAnamneses: deletedCount.anamneses,
        filesDeleted: deletedCount.files,
        errors: deletedCount.errors,
      });
    }

    // ── send_media_deletion_reminder — roda todo dia às 09h00 ────────────────
    // Envia lembrete 48h antes da deleção quando lembrete_enviado = false
    if (body.job === "send_media_deletion_reminder") {
      const env = getEdgeRuntimeEnv();
      const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

      // Anamneses que expiram nas próximas 48h, ainda não deletadas, lembrete não enviado e com mídias
      const { data: pending, error: pendingErr } = await serviceRoleClient
        .from("anamneses")
        .select(
          "id, full_name, teacher_id, media_expires_at, " +
          "foto_frontal_url, foto_lateral_url, foto_posterior_url, " +
          "deep_squat_video_frontal_url, deep_squat_video_lateral_url, deep_squat_video_posterior_url",
        )
        .lte("media_expires_at", in48h)
        .gt("media_expires_at", now.toISOString())
        .eq("media_lembrete_enviado", false)
        .eq("media_deletado", false);

      if (pendingErr) throw new EdgeHttpError("send_media_deletion_reminder_failed", pendingErr.message, 400);

      type ReminderRow = {
        id: string;
        full_name: string;
        teacher_id: string | null;
        media_expires_at: string;
        foto_frontal_url: string | null;
        foto_lateral_url: string | null;
        foto_posterior_url: string | null;
        deep_squat_video_frontal_url: string | null;
        deep_squat_video_lateral_url: string | null;
        deep_squat_video_posterior_url: string | null;
      };

      const sent: string[] = [];

      for (const row of (pending ?? []) as ReminderRow[]) {
        if (!row.teacher_id) continue;

        const { data: teacher } = await serviceRoleClient
          .from("teachers").select("user_id").eq("id", row.teacher_id).maybeSingle();
        if (!teacher?.user_id) continue;

        const { data: profile } = await serviceRoleClient
          .from("profiles").select("email").eq("id", teacher.user_id).maybeSingle();
        if (!profile?.email) continue;

        const hasPhotos = !!(row.foto_frontal_url || row.foto_lateral_url || row.foto_posterior_url);
        const hasVideos = !!(
          row.deep_squat_video_frontal_url ||
          row.deep_squat_video_lateral_url ||
          row.deep_squat_video_posterior_url
        );

        if (!hasPhotos && !hasVideos) continue;

        if (!body.dryRun) {
          await sendMediaDeletionReminderEmail({
            coachEmail: profile.email as string,
            studentName: row.full_name,
            mediaExpiresAt: row.media_expires_at,
            hasPhotos,
            hasVideos,
            downloadLink: `${appUrl}/anamneses`,
          }).catch(console.warn);

          await serviceRoleClient
            .from("anamneses")
            .update({ media_lembrete_enviado: true })
            .eq("id", row.id);
        }

        sent.push(row.id);
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        remindersSent: sent.length,
      });
    }

    throw new EdgeHttpError("unsupported_job", "Job nao implementado.", 400);
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
