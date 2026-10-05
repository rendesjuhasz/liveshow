# Automatikus időzóna

Műsor (`Show`) = esemény. A DB-ben **csak UTC** van: `startTime` (= `startAtUtc`), opcionális `endTime` (= `endAtUtc`). A streamer eredeti IANA zónája: `Show.timezone`.

Létrehozás: `startLocal` + `timezone` (nem `new Date(datetime-local).toISOString()`, ha a zóna felülírt).

API minden show DTO-ban: `startAtUtc`, `endAtUtc`, `timezone`, `scheduleStatus`, plusz kompatibilitás: `startTime`.

ICS: `GET /shows/:id/calendar.ics` (UTC DTSTART).
