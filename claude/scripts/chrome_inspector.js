#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const sidebarName = process.argv[2];
if (!sidebarName) {
  console.error('Please provide the SidebarName, e.g. TaskTypeSidebar');
  process.exit(1);
}

const targetFileDir = path.resolve(__dirname, '../.agents/temp');
const targetFilePath = path.join(targetFileDir, `${sidebarName}_design.json`);

// Read package name from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const projectName = packageJson.name;

async function run() {
  const distDir = path.resolve(__dirname, '../plugin/app/dist');
  console.log(`Starting httpster server on port 9998, serving: ${distDir}...`);

  const httpster = spawn('npx', ['httpster', '-p', '9998', '-d', distDir, '-c'], {
    shell: true,
    stdio: 'ignore',
  });

  const cleanup = () => {
    try {
      httpster.kill();
    } catch (e) {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit();
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit();
  });

  // Give httpster a moment to start up
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`Connecting to Chrome remote debugging at http://localhost:9222...`);

  let targets;
  try {
    const res = await fetch('http://localhost:9222/json');
    targets = await res.json();
  } catch (err) {
    console.error('Error connecting to http://localhost:9222/json.');
    console.error('Please make sure Chrome is running with remote debugging enabled:');
    console.error('  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
    process.exit(1);
  }

  const pages = targets.filter((t) => t.type === 'page');
  if (pages.length === 0) {
    console.error('No pages found in remote debugging targets.');
    process.exit(1);
  }

  console.log(`Found ${pages.length} pages:`);
  for (const page of pages) {
    console.log(`  - Title: "${page.title}", URL: "${page.url}"`);
  }

  // We find the page that matches Glyvio or look for the one with app-beta.glyvio.com or glyvio in general
  const targetPage = pages.find((p) => p.url.includes('glyvio') || p.title.includes('Glyvio')) || pages[0];

  let id = 1;
  const evalId = 999;
  let hasReloaded = false;
  let isFinished = false;
  let ws;

  function connect() {
    console.log(`\nConnecting to target page: "${targetPage.title}" (${targetPage.url})`);
    ws = new WebSocket(targetPage.webSocketDebuggerUrl);

    ws.onopen = () => {
      console.log('WebSocket connection established. Enabling Runtime domains...');
      // Enable console events
      ws.send(JSON.stringify({ id: id++, method: 'Runtime.enable' }));

      if (!hasReloaded) {
        hasReloaded = true;
        console.log('Injecting localStorage and triggering page reload...');
        // Inject localStorage key-value pair for app_rule_plugins and reload the page
        const setStorageAndReloadExpr = `
          try {
            localStorage.setItem('flutter.C:GLOBAL-k:app_rule_plugins', '"{\\\\"${projectName}\\\\": \\\\"http://localhost:9998/bundle.js\\\\"}"');
            localStorage.setItem('flutter.C:GLOBAL-k:USER_PREFERENCE', '"{\\\\"developerOptions\\\\":true,\\\\"brightness\\\\":\\\\"light\\\\",\\\\"language\\\\":\\\\"en_US\\\\",\\\\"extras\\\\":{}}"');
            console.log("Successfully injected 'flutter.C:GLOBAL-k:app_rule_plugins' and 'flutter.C:GLOBAL-k:USER_PREFERENCE' to localStorage. Reloading page...");
            location.reload();
          } catch (e) {
            console.error("Failed to set localStorage item or reload:", e);
          }
        `;
        ws.send(
          JSON.stringify({
            id: id++,
            method: 'Runtime.evaluate',
            params: {
              expression: setStorageAndReloadExpr,
              returnByValue: true,
            },
          }),
        );
      }

      // Start polling window.__finalDesign immediately and continuously
      setInterval(() => {
        ws.send(
          JSON.stringify({
            id: evalId,
            method: 'Runtime.evaluate',
            params: {
              expression: 'window.__finalDesign',
              returnByValue: true,
            },
          }),
        );
      }, 1000);
      console.log('Polling for window.__finalDesign... (Please open modal if not populated yet)');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Check console api call events
        if (msg.method === 'Runtime.consoleAPICalled') {
          const type = msg.params.type;
          const args = msg.params.args.map((a) => (a.value !== undefined ? a.value : a.description || ''));
          console.log(`[Browser Console - ${type}]:`, ...args);
        }

        // Check result of polling eval
        if (msg.id === evalId) {
          if (msg.result && msg.result.result && msg.result.result.value) {
            const design = msg.result.result.value;
            console.log(`\nFound design JSON! Saving to ${targetFilePath}...`);
            if (!fs.existsSync(targetFileDir)) {
              fs.mkdirSync(targetFileDir, { recursive: true });
            }
            fs.writeFileSync(targetFilePath, JSON.stringify(design, null, 2), 'utf-8');
            console.log('Success! File saved.');
            isFinished = true;
            ws.close();
            process.exit(0);
          } else {
            process.stdout.write('.');
          }
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      if (!hasReloaded) {
        process.exit(1);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed.');
      if (!isFinished) {
        console.log('Reconnecting in 1.5 seconds to wait for page reload to complete...');
        setTimeout(connect, 1500);
      }
    };
  }

  connect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
