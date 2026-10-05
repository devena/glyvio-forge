---
name: use-audio-recorder
description: "Records audio from a view with glyvio_core.audioRecorderService (start, pause, resume, stop with automatic upload to an attachment, cancel, status, background recording) and plays audio attachments or URLs — e.g. voice notes on a record, call or visit recordings."
---
# Agent Skill: Record and Play Audio

`glyvio_core.audioRecorderService` (app layer):

| Method | Returns |
| --- | --- |
| `startRecording({ onFinishedKey?, extras? })` | `AudioRecordingStatus` (`status: 'idle' \| 'recording' \| 'paused' \| 'uploading'`, `elapsedSeconds`) |
| `pauseRecording()` / `resumeRecording()` / `cancelRecording()` | `AudioRecordingStatus` |
| `stopRecording()` | `StopAudioRecordingResult` (`attachment` — the uploaded file, `elapsedSeconds`, `extras`) |
| `getStatus()` | current `AudioRecordingStatus` |
| `playAudio(attachmentId \| { attachmentId?, url? })`, `stopAudio()`, `pausePlayback()`, `resumePlayback()` | playback |

Views also have `this.audioPlay(attachmentId)` / `this.audioStop()`.

---

## 🚫 Rules

1. Start only on a user action; show the recording state (elapsed time, pause/stop buttons) from `getStatus()`.
2. `stopRecording()` uploads the file as a **temporary** attachment: persist and link it to the record
   with `glyvio_core.attachmentService.saveAttachment(attachment, [{ entityId, entityName }], false)`,
   setting `userGroupId` from the owner record (see `use-view-extensions`).
3. `onFinishedKey`: the action key your view receives when the recording finishes outside your
   control (e.g. stopped from the OS notification); handle it in `events()`.
4. Always offer cancel; call `cancelRecording()` when the user leaves the screen mid-recording.

---

## 📄 Code Blueprint

```typescript
async function stopAndAttach(owner: glyvio_entity.<EntityName>): Promise<glyvio_entity.Attachment | undefined> {
  const result = await glyvio_core.audioRecorderService.stopRecording();
  const attachment = result.attachment as glyvio_entity.Attachment | undefined;
  if (!attachment || !owner.id) {
    return undefined;
  }
  attachment.userGroupId = owner.userGroupId;
  return glyvio_core.attachmentService.saveAttachment(
    attachment,
    [{ entityId: owner.id, entityName: glyvio_structure.AllEntities.<entityCamel>.getStructureName() }],
    false,
  );
}

// events():
// if (action.key == 'rec') { await glyvio_core.audioRecorderService.startRecording({ onFinishedKey: '<plugin>_recFinished' }); return 'STATE_UPDATE'; }
// if (action.key == 'stop' || action.key == '<plugin>_recFinished') { await stopAndAttach(state.<entityCamel>!); return 'STATE_UPDATE'; }
```

---

## ✅ Completion Checklist

- [ ] Recording UI reflects `getStatus()`; cancel available.
- [ ] Stopped recordings persisted and linked with `userGroupId`.
- [ ] Tested on a real device (microphone permission).
