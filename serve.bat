@echo off
setlocal
cd /d %~dp0
echo Serveur local PWA sur http://localhost:5173
echo (Fermer la fenetre pour arreter)
py -m http.server 5173
