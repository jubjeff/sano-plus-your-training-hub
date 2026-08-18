-- Reduz limite do bucket anamnesis-videos de 200 MB para 15 MB por arquivo.
-- Fotos são comprimidas no frontend antes do upload (target ~800 KB via WebP).
-- Vídeos do Deep Squat: gravar em 720p mantém tamanho abaixo de 15 MB.
update storage.buckets
set file_size_limit = 15728640  -- 15 MB
where id = 'anamnesis-videos';

-- Reduz também o bucket de fotos para refletir o tamanho pós-compressão
update storage.buckets
set file_size_limit = 2097152  -- 2 MB (sobra folgada após compressão para 800 KB)
where id = 'anamnesis-photos';
