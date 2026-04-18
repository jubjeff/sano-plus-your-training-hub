export { getSupabaseClient, getOptionalSupabaseClient, resetSupabaseClient, hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";
export { getRequiredSupabaseRuntimeConfig, getSupabaseRuntimeConfig, getSupabaseAppUrl, getSupabaseFunctionsRegion, SUPABASE_ENV_KEYS } from "@/integrations/supabase/config";
export { invokeSupabaseEdgeFunction, SupabaseEdgeFunctionError } from "@/integrations/supabase/functions";
export { EDGE_FUNCTION_CATALOG, EDGE_FUNCTION_NAMES } from "@/integrations/supabase/function-contracts";
export { mapAuthRoleToSupabaseProfileRole, mapSupabaseProfileRecord, mapSupabaseProfileRoleToAuthRole } from "@/integrations/supabase/profile-mappers";
export type { SupabaseDatabasePlaceholder, SupabaseProfileRecord, SupabaseProfileRole } from "@/integrations/supabase/types";
export type { EdgeFunctionCatalogItem, EdgeFunctionCategory, EdgeFunctionEnvelope, EdgeFunctionErrorEnvelope, EdgeFunctionExposure, EdgeFunctionName, EdgeFunctionSuccessEnvelope, TeacherAdminAction, TeacherAdminActionPayload, TeacherAdminActionPayloadMap, TeacherAdminActionRequest } from "@/integrations/supabase/function-contracts";
