---
name: use-device-location
description: "Reads the device GPS position from a view with glyvio_core.locationService — current or last known position, accuracy/timeout options, permission check/request, and opening the OS settings when location is off — e.g. to stamp a visit, check-in or delivery with coordinates."
---
<!-- Generated from src/skills/use-device-location/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Use the Device Location

`glyvio_core.locationService` (app layer only):

| Method | Returns |
| --- | --- |
| `getCurrentPosition({ accuracy?, timeLimitSeconds? })` | `LocationPosition` (`latitude`, `longitude`, `accuracy`, `altitude`, `heading`, `speed`, `timestamp`, `isMocked?`); throws `GlyvioError` when GPS is off or permission denied |
| `getLastKnownPosition()` | cached `LocationPosition \| null` (fast, may be old) |
| `isLocationServiceEnabled()` | `boolean` |
| `checkPermission()` / `requestPermission()` | `'denied' \| 'deniedForever' \| 'whileInUse' \| 'always' \| 'unableToDetermine'` |
| `openLocationSettings()` / `openAppSettings()` | opens the OS screens |

`accuracy`: `'lowest' | 'low' | 'medium' | 'high' | 'best' | 'bestHighAccuracy'`.

---

## 🚫 Rules

1. Ask for the position only on a user action (button), never in `initState`.
2. Check/request permission first and explain what to do when it is `'deniedForever'` (offer `openAppSettings`).
3. Always pass `timeLimitSeconds` and handle the error (toast) — indoors a fix may never come.
4. Store coordinates in `Decimal` columns (`latitude`/`longitude`); reject or flag `isMocked` positions when the business requires it.
5. Show a progress dialog or loading state while waiting (`keyLoadingComponent` on the button).

---

## 📄 Code Blueprint

```typescript
async function captureLocation(view: glyvio_core.CoreView<glyvio_core.CoreState<glyvio_core.CoreRouteParams>>, state: glyvio_core.CoreState<glyvio_core.CoreRouteParams>, target: glyvio_entity.<EntityName>): Promise<boolean> {
  if (!(await glyvio_core.locationService.isLocationServiceEnabled())) {
    await view.showToastWarning(state, '$T{<plugin>_gpsOff}');
    await glyvio_core.locationService.openLocationSettings();
    return false;
  }
  let permission = await glyvio_core.locationService.checkPermission();
  if (permission == 'denied') {
    permission = await glyvio_core.locationService.requestPermission();
  }
  if (permission == 'denied' || permission == 'deniedForever') {
    await view.showToastWarning(state, '$T{<plugin>_gpsPermission}');
    return false;
  }
  const pos = await glyvio_core.locationService.getCurrentPosition({ accuracy: 'high', timeLimitSeconds: 15 });
  target.latitude = pos.latitude;
  target.longitude = pos.longitude;
  return true;
}
```

Call it from `events()` (e.g. `if (action.key == 'checkIn') { await captureLocation(this, state, state.visit!); ... }`).

---

## ✅ Completion Checklist

- [ ] Permission + service checks with user-facing messages.
- [ ] Timeout set and errors handled.
- [ ] Tested on a real device (browser location prompts behave differently).
