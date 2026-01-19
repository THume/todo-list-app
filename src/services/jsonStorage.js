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
