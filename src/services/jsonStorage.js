const API_BASE = '/api/storage';

const encodeFileName = (fileName) => encodeURIComponent(fileName);

export async function readJsonFile(fileName, fallbackValue) {
  try {
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

    return true;
  } catch (error) {
    console.error(`Failed to write JSON file "${fileName}"`, error);
    return false;
  }
}

export async function listBackupSnapshots() {
  try {
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
