# Example: Creating a Custom Environment Action

This example demonstrates how to define a custom action in the **Environment** subproject using the `@Action` decorator. Actions are triggered by external environments or services to execute synchronization, integration, or utility routines.

## Scenario

We want to define an action named `slack_send_notification` that takes a text message (as a JSON payload) and posts it to a Slack webhook URL retrieved from the environment's configurations.

---

## 🛠️ Complete Implementation

Create a new file (e.g., `src/actions/slack_notification_action.ts`) in your plugin workspace and paste the following content:

```typescript
/**
 * Action that sends notifications to a Slack webhook.
 *
 * Actions are registered automatically at runtime if they use the `@glyvio_core.Action` decorator.
 * Access all necessary interfaces and services via the global `glyvio_core` namespace.
 */
@glyvio_core.Action({
  id: 'slack_send_notification',
})
export class SlackNotificationAction extends glyvio_core.SimpleAction {
  /**
   * Executed when the action is called.
   *
   * @param request - Optional JSON string containing action parameters (e.g., message content).
   * @returns A promise that resolves to the result of the action execution.
   */
  async handle(request?: string): Promise<string | undefined> {
    if (!request) {
      throw new Error('Request payload is required.');
    }

    // Parse the request arguments
    const payload = JSON.parse(request) as { message: string };
    if (!payload.message) {
      throw new Error('Message field is missing from request.');
    }

    // Retrieve webhook URL from environment config service (stored securely)
    // Assume we have a secret configured for this service
    const slackSecret = glyvio_core.secretService.getPopulatedSecretById<{ webhookUrl: string }>(
      'slack-integration-webhook',
    );

    if (!slackSecret || !slackSecret.secret?.webhookUrl) {
      throw new Error('Slack webhook URL secret is not configured.');
    }

    const webhookUrl = slackSecret.secret.webhookUrl;

    // Post to Slack (using globally available fetch or http client)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload.message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send slack message: ${response.status} - ${errorText}`);
    }

    // Return a success JSON result
    return JSON.stringify({
      success: true,
      timestamp: glyvio_core.DateTime.now().format('yyyy-MM-dd HH:mm:ss'),
    });
  }
}
```

---

## 🔍 Key Architectural Points

1. **`@glyvio_core.Action`**:
   - Registers the action handler.
   - `id` defines the action name that will be referenced when calling `glyvio_core.environmentService.callEnvironmentActionRaw()`.
2. **`SimpleAction` Extension**:
   - The action handler must extend `glyvio_core.SimpleAction` and implement the `handle(request?: string)` method.
3. **Parameter Parsing & Serialization**:
   - Because the action is bridged across environments, inputs and outputs are serialized as strings.
   - Use `JSON.parse` to extract parameters and `JSON.stringify` to format responses.
4. **Secret Integration**:
   - Avoid hardcoding API keys or webhooks. Use `glyvio_core.secretService.getPopulatedSecretById()` to retrieve credentials securely.
