const STORAGE_KEY = 'profile';

const textarea = document.getElementById('profile');
const statusDiv = document.getElementById('status');

function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.className = isError ? 'error' : 'ok';
}

function parseProfile() {
  try {
    const parsed = JSON.parse(textarea.value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      showStatus('Profile must be a JSON object.', true);
      return null;
    }
    return parsed;
  } catch (e) {
    showStatus('Invalid JSON: ' + e.message, true);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(STORAGE_KEY, function(result) {
    if (result[STORAGE_KEY]) {
      textarea.value = JSON.stringify(result[STORAGE_KEY], null, 2);
      showStatus('Loaded saved profile.');
    } else {
      showStatus('No profile saved yet.');
    }
  });
});

document.getElementById('save').addEventListener('click', function() {
  const profile = parseProfile();
  if (!profile) return;
  chrome.storage.local.set({ [STORAGE_KEY]: profile }, function() {
    textarea.value = JSON.stringify(profile, null, 2);
    showStatus('Saved.');
  });
});

document.getElementById('format').addEventListener('click', function() {
  const profile = parseProfile();
  if (!profile) return;
  textarea.value = JSON.stringify(profile, null, 2);
  showStatus('Formatted (not saved yet).');
});

// One-time migration helper for users who still have data.json in the extension folder.
document.getElementById('importBundled').addEventListener('click', async function() {
  try {
    const response = await fetch(chrome.runtime.getURL('data.json'));
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    textarea.value = JSON.stringify(data, null, 2);
    showStatus('Imported data.json — click Save to store it.');
  } catch (e) {
    showStatus('No bundled data.json found in the extension folder.', true);
  }
});

document.getElementById('clear').addEventListener('click', function() {
  if (!confirm('Remove the saved profile from browser storage?')) return;
  chrome.storage.local.remove(STORAGE_KEY, function() {
    textarea.value = '';
    showStatus('Saved profile removed.');
  });
});
