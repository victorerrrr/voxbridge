VoxBridge — бэкап перед переустановкой Windows
==============================================

Сохраните всю папку этого репозитория (git) + при необходимости:
  voice-matching-service\pretrained_models\spkrec-ecapa-voxceleb\
  (веса ECAPA, иначе скачаются заново)

История чатов Cursor (опционально):
  C:\Users\_r3drum\.cursor\projects\c-Users-r3drum-Desktop-all-voxbridge\agent-transcripts\

Документация прогресса — папка docs\:

  docs\ПРОГРЕСС_ПРОЕКТА.md      — что сделано, как запустить, проблемы
  docs\АРХИТЕКТУРА_VOICE_MATCHING.md — пайплайн AI matching
  docs\ПЛАН_ДАЛЬШЕ.md           — что ещё не сделано
  docs\СОХРАНЕНИЕ_АГЕНТОВ.md    — Cursor, транскрипты, возобновление

Быстрый старт после переустановки:
  1) npm install && npm run dev
  2) cd voice-matching-service && scripts\install-deps.ps1 && scripts\run-server.ps1
  3) http://localhost:3000/admin/ai-voice-matching

Май 2026.
