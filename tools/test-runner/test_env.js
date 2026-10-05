// Test settings for the ad-hoc scripts in this folder. Everything comes from `.env` (never commit
// it) or the shell environment — no URL, account, password or id is hardcoded in the scripts.
//
//   G_APP_URL        Glyvio App URL to open (legacy: GLYVIO_APP_URL)
//   G_API_URL        API base URL of that environment, when a script calls the API directly
//   G_JEANNIE_URL    URL of the Jeannie web client, for the inbox scripts
//   G_USERNAME       login of the test account (legacy: GLYVIO_EMAIL)
//   G_PASSWORD       password of the test account (legacy: GLYVIO_PASSWORD)
//   G_INBOX_USERNAME login used by the inbox scripts; its password stays in JEANNIE_INBOX_PASSWORD
//   G_COMPANY_ID, G_SERVICE_ID, G_ENVIRONMENT_ID   ids of the test company/service/environment
//   G_TARGET_ID, G_CHAT_SESSION_ID, G_TASK_ID, G_USER_GROUP_ID, G_ENTRY_ID, G_PLUGIN_RECORD_ID
//                    ids of the records a debug script inspects or writes
//   G_SHOT_DIR       where screenshots are written (default: ./screenshots)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const env = (...names) => names.map((n) => process.env[n]).find((v) => v != null && v !== '') ?? '';

module.exports = {
  appUrl: env('G_APP_URL', 'GLYVIO_APP_URL').replace(/\/$/, ''),
  apiUrl: env('G_API_URL').replace(/\/$/, ''),
  jeannieUrl: env('G_JEANNIE_URL'),
  username: env('G_USERNAME', 'GLYVIO_EMAIL'),
  password: env('G_PASSWORD', 'GLYVIO_PASSWORD'),
  inboxUsername: env('G_INBOX_USERNAME'),
  companyId: env('G_COMPANY_ID'),
  serviceId: env('G_SERVICE_ID'),
  environmentId: env('G_ENVIRONMENT_ID'),
  targetId: env('G_TARGET_ID'),
  chatSessionId: env('G_CHAT_SESSION_ID'),
  taskId: env('G_TASK_ID'),
  userGroupId: env('G_USER_GROUP_ID'),
  entryId: env('G_ENTRY_ID'),
  pluginRecordId: env('G_PLUGIN_RECORD_ID'),
  shotDir: env('G_SHOT_DIR') || path.join(__dirname, 'screenshots'),
};
