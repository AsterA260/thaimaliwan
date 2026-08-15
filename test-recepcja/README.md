# AsterA Recepcja — test GitHub Pages

Statyczny, odizolowany pakiet testowy na bazie zaakceptowanych makiet UI-R3F i UI-R4.

- `index.html` — Mandala oraz działający lokalnie widok Rezerwacji/Grafiku;
- `bony/` — Bony i partnerzy, dostępne z kuli na Mandali;
- `flow-bonu/` — demonstracja miesięcznego wyboru terminów VOUCHER.

## Bezpieczeństwo

Ten katalog nie ma kluczy, nie wywołuje Apps Script, nie zawiera endpointu zapisu i nie zapisuje danych do Google Sheets. W szczególności `ASTERA_INTEGRATION_ENABLED=false` w makiecie Rezerwacji pozostaje celowe.

Jest przeznaczony wyłącznie do testów UX na GitHub Pages. Podłączenie odczytu danych lub zapisu przez v27 wymaga osobnego GO.
