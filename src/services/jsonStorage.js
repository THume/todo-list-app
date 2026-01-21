const API_BASE = '/api/storage';

const encodeFileName = (fileName) => encodeURIComponent(fileName);
const FORCE_STORAGE_FAILURE_KEY = 'todo-list.force-storage-failure';

const isForcedStorageFailure = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(FORCE_STORAGE_FAILURE_KEY) === 'true';
  } catch (error) {
    return false;
  }
};

export async function readJsonFile(fileName, fallbackValue) {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage read failure.');
    }
    const response = await fetch(`${API_BASE}/${encodeFileName(fileName)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: true, data: fallbackValue };
      }
      throw new Error(`Failed to read JSON file "${fileName}": ${response.statusText}`);
    }

    const text = await response.text();
    if (!text) {
      return { ok: true, data: fallbackValue };
    }

    return { ok: true, data: JSON.parse(text) };
  } catch (error) {
    console.error(`Failed to read JSON file "${fileName}"`, error);
    return { ok: false, data: fallbackValue, error };
  }
}

export async function writeJsonFile(fileName, data) {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage write failure.');
    }
    const response = await fetch(`${API_BASE}/${encodeFileName(fileName)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data ?? null),
    });

    if (!response.ok) {
      throw new Error(`Failed to write JSON file "${fileName}": ${response.statusText}`);
    }

    return { ok: true };
  } catch (error) {
    console.error(`Failed to write JSON file "${fileName}"`, error);
    return { ok: false, message: error?.message ?? 'Failed to write JSON file.' };
  }
}

export async function listBackupSnapshots() {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage list failure.');
    }
    const response = await fetch(`${API_BASE}/backups`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list backups: ${response.statusText}`);
    }

    const payload = await response.json();
    return { ok: true, snapshots: payload?.snapshots ?? [] };
  } catch (error) {
    console.error('Failed to list backup snapshots', error);
    return { ok: false, snapshots: [], error };
  }
}

export async function restoreBackupSnapshot(snapshotId) {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage restore failure.');
    }
    const response = await fetch(`${API_BASE}/backups/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: snapshotId }),
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        if (payload?.error) {
          message = payload.error;
        }
      } catch (error) {
        // ignore payload parsing errors
      }
      throw new Error(`Failed to restore backup: ${message}`);
    }

    return { ok: true };
  } catch (error) {
    console.error('Failed to restore backup snapshot', error);
    return { ok: false, error };
  }
}

export async function exportDataBundle() {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage export failure.');
    }
    const response = await fetch(`${API_BASE}/export`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to export data: ${response.statusText}`);
    }

    const payload = await response.json();
    return { ok: true, data: payload };
  } catch (error) {
    console.error('Failed to export data bundle', error);
    return { ok: false, data: null, error };
  }
}

export async function importDataBundle(bundle) {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage import failure.');
    }
    const response = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bundle ?? {}),
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        if (payload?.error) {
          message = payload.error;
        }
      } catch (error) {
        // ignore payload parsing errors
      }
      throw new Error(`Failed to import data: ${message}`);
    }

    return { ok: true };
  } catch (error) {
    console.error('Failed to import data bundle', error);
    return { ok: false, error };
  }
}

export async function getStorageSettings() {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage settings read failure.');
    }
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to read settings: ${response.statusText}`);
    }

    const payload = await response.json();
    return { ok: true, settings: payload?.settings ?? {} };
  } catch (error) {
    console.error('Failed to read storage settings', error);
    return { ok: false, settings: {}, error };
  }
}

export async function updateStorageSettings(settings) {
  try {
    if (isForcedStorageFailure()) {
      throw new Error('Forced storage settings write failure.');
    }
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings ?? {}),
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        if (payload?.error) {
          message = payload.error;
        }
      } catch (error) {
        // ignore payload parsing errors
      }
      throw new Error(`Failed to update settings: ${message}`);
    }

    const payload = await response.json();
    return { ok: true, settings: payload?.settings ?? {} };
  } catch (error) {
    console.error('Failed to update storage settings', error);
    return { ok: false, settings: {}, error };
  }
}
