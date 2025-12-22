# My-SGTM-KPI
 
 A Laravel + React application for tracking and managing HSE KPIs.
 
 ## Requirements
 
 - PHP
   - If you use XAMPP, the scripts auto-detect `C:\xampp\php\php.exe`.
 - Composer
 - Node.js + npm
 
 ## Project structure
 
 - `backend/`: Laravel API + serves the built frontend from `backend/public`
 - `frontend/`: React (Vite) app
 
 ## Start (recommended)
 
 ### Start the app (Laravel serving the built frontend)
 
 From the project root:
 
 - Run `start-servers.bat`
 
 Notes:
 
 - This builds the frontend into `backend/public` (Vite `outDir` is configured accordingly).
 - Then it starts Laravel on `http://localhost:8000`.
 - To skip the frontend build step:
   - `start-servers.bat --skip-build`
 
 ### Stop the app
 
 - Run `stop-servers.bat`
 
 ## Auto-start on Windows
 
 - Run `setup-autostart.bat`
 
 Optional (requires Administrator):
 
 - `setup-autostart.bat --firewall`
 - `setup-autostart.bat --service`
 - `setup-autostart.bat --monitor`
 
 To remove auto-start settings:
 
 - Run `cleanup-autostart.bat`
 
 ## Status check
 
 Optional external URL check:
 
 - `set EXTERNAL_URL=http://your-ip:8000/`
 - Run `check-status.bat`"# MysafeKPI-SGTM" 
