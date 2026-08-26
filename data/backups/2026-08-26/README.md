# Respaldo 2026-08-26

Copia de las tres fuentes CSV publicadas que consumía `opentennis.cl` al iniciar la fase 0.

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `fixture.csv` | 7727 | `48C3E6B026A927B674E9A29FC7B1A2F5E7F8A96FF22CA33612CC50A5CEF1B1DD` |
| `registro.csv` | 10344 | `A1B1E47081FCA985CF252291585E39FAA6ACB856B1590D05069BB1C47666BEB4` |
| `rankings.csv` | 917 | `AE2211374EAD13B0110EB4DC33F931C5FDB824B4F630D50F28A5D879BC1DB166` |

Para comprobarlos en PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 *.csv
```
