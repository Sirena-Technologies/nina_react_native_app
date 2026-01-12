import * as FileSystem from 'expo-file-system';

export class ActionFileReader {
  public static async readActionFile(filename: string): Promise<number[][]> {
    try {
      // Try multiple possible paths for action files
      const possiblePaths = [
        `${FileSystem.bundleDirectory}assets/actions/${filename}`,
        `${FileSystem.bundleDirectory}assets/${filename}`,
        `${FileSystem.documentDirectory}${filename}`,
      ];

      for (const fileUri of possiblePaths) {
        try {
          const content = await FileSystem.readAsStringAsync(fileUri);
          const lines = content.split('\n');
          const data: number[][] = [];

          for (const line of lines) {
            if (line.trim()) {
              const row = line.split(',').map((val) => parseInt(val.trim(), 10));
              if (row.length > 0 && !isNaN(row[0])) {
                data.push(row);
              }
            }
          }

          if (data.length > 0) {
            return data;
          }
        } catch (error) {
          // Try next path
          continue;
        }
      }

      console.warn(`Action file ${filename} not found in any expected location`);
      return [];
    } catch (error) {
      console.error('Error in readActionFile:', error);
      return [];
    }
  }

  public static s2b(a: string): number {
    const buffer = a.split('');
    let ans = 0;
    for (let i = 0; i < buffer.length; i++) {
      ans = ans * 10 + (buffer[i].charCodeAt(0) - 48);
    }
    return ans;
  }
}
