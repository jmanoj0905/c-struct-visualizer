# How to Run This Project Locally

A super simple guide to get the C Struct Visualizer running on your computer!

## What You Need First

Before starting, make sure you have these installed:

1. **Node.js** (version 16 or higher)
   - Download from: https://nodejs.org/
   - This includes `npm` (the package manager)
   - Check if installed: Open terminal and type `node --version`

2. **A Web Browser**
   - Chrome, Firefox, Safari, or Edge - any modern browser works!

3. **A Terminal/Command Line**
   - Mac: Use "Terminal" app
   - Windows: Use "Command Prompt" or "PowerShell"
   - Linux: Use your terminal

## Step-by-Step Instructions

### Step 1: Open Terminal
- **Mac**: Press `Cmd + Space`, type "Terminal", press Enter
- **Windows**: Press `Win + R`, type "cmd", press Enter
- **Linux**: Press `Ctrl + Alt + T`

### Step 2: Go to the Project Folder
Type this in your terminal (replace with your actual path):
```bash
cd /path/to/c-struct-visualizer
```

For example:
```bash
cd /Users/yourname/Downloads/c-struct-visualizer
```

**Tip**: You can drag the folder into the terminal to get the path automatically!

### Step 3: Install Dependencies
This downloads all the libraries the project needs. Type:
```bash
npm install
```

Wait for it to finish (takes 30-60 seconds). You'll see a progress bar.

### Step 4: Start the Development Server
Type:
```bash
npm run dev
```

You should see something like:
```
VITE v7.2.7  ready in 603 ms

➜  Local:   http://localhost:5173/
```

### Step 5: Open in Browser
- Look for the line that says `Local: http://localhost:5173/`
- **Either:**
  - Hold `Cmd` (Mac) or `Ctrl` (Windows/Linux) and click the link
  - **Or** manually open your browser and go to: `http://localhost:5173/`

### Step 6: You're Done!
The app should now be running in your browser! 🎉

## Using the App

Once it opens:
1. You'll see a canvas with a toolbar at the top
2. Select "Node" from the dropdown
3. Click "Add Instance" button
4. A blue block appears - drag it around!
5. Add more instances and connect them

## Common Issues

### Issue: "command not found: npm"
**Solution**: You need to install Node.js first (see "What You Need First" section)

### Issue: Port 5173 is already in use
**Solution**: Another app is using that port. Either:
- Close the other app
- Or the server might already be running! Just open `http://localhost:5173/`

### Issue: "Cannot find module"
**Solution**: Run `npm install` again to install dependencies

### Issue: Browser shows blank page
**Solution**:
1. Check the terminal for error messages
2. Try refreshing the page (press `F5` or `Cmd/Ctrl + R`)
3. Clear browser cache and reload

## Stopping the Server

When you're done:
- Go back to the terminal
- Press `Ctrl + C` (on both Mac and Windows)
- This stops the server

## Running Again Later

Next time you want to use the app:
1. Open terminal
2. Go to project folder: `cd /path/to/c-struct-visualizer`
3. Run: `npm run dev`
4. Open: `http://localhost:5173/`

That's it! No need to run `npm install` again unless you delete the `node_modules` folder.

## Building for Production

If you want to create a production build (optimized files):
```bash
npm run build
```

This creates a `dist` folder with optimized files you can deploy to a web server.

## Need More Help?

- Check `README.md` for detailed documentation
- Check `QUICKSTART.md` for using the app
- Look for error messages in the terminal - they usually tell you what's wrong!

## Quick Reference

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

**That's all! Happy visualizing! 🚀**
