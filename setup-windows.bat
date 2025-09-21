@echo off
:: ==================================================================
:: =    Lanzador Definitivo del Ecosistema Nyx OS "MONDAYGRAY"      =
:: ==================================================================
:: Este script abre una nueva ventana de terminal para ejecutar
:: todos los servicios, manteniendo esta ventana limpia.
:: Para detener el ecosistema, simplemente cierra la nueva ventana.
:: ------------------------------------------------------------------

@echo off
echo Iniciando el Ecosistema Nyx en una nueva ventana...

start "Nyx OS Ecosystem" cmd /k "npm run start-ecosystem"

exit

