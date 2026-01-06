import { readDir, readTextFile, writeTextFile, mkdir, remove, rename } from '@tauri-apps/plugin-fs';
import { type } from '@tauri-apps/plugin-os';

// Helper: Cek apakah jalan di Tauri
// @ts-ignore
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

export class EditorStore {
    activeFileId = $state<string | null>(null);
    activeFileName = $state<string>(''); 
    content = $state<string>('');
    files = $state<any[]>([]);
    
    rootPath = ''; 
    currentPath = $state(''); 

    wordCount = $derived(this.content.trim() === '' ? 0 : this.content.trim().split(/\s+/).length);
    charCount = $derived(this.content.length);

    constructor() {
        this.initPath();
    }

    async initPath() {
        if (!isTauri) return;
        try {
            const platformName = await type();
            if (platformName === 'android') {
                this.rootPath = '/storage/emulated/0/MilkyNote_Sync';
            } else {
                this.rootPath = '/home/priosmilky/Documents/Note';
            }
            this.currentPath = this.rootPath;
            setTimeout(() => this.loadFiles(), 500);
        } catch (err) {
            console.error("Gagal init path:", err);
            this.rootPath = '/home/priosmilky/Documents/Note';
            this.currentPath = this.rootPath;
            this.loadFiles();
        }
    }

    async loadFiles() {
        if (!isTauri || !this.currentPath) return;
        try {
            const entries = await readDir(this.currentPath);
            this.files = entries
                .map(entry => ({
                    name: entry.name,
                    id: entry.name,
                    is_dir: entry.isDirectory
                }))
                .sort((a, b) => {
                    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                });
        } catch (err) { 
            console.error("Gagal baca folder:", err);
        }
    }

    // Fungsi untuk membaca isi file teks (Memperbaiki error Property 'readFileContents' does not exist)
    async readFileContents(fullPath: string) {
        try {
            return await readTextFile(fullPath);
        } catch (err) {
            console.error("Gagal membaca file:", err);
            return "";
        }
    }

    // Fungsi Rekursif untuk mengambil SEMUA konten di dalam folder dan sub-folder
    async getRecursiveContent(path: string, level = 0) {
        let combined = "";
        try {
            const entries = await readDir(path);
            // Sort agar urutan file rapi
            const sortedEntries = entries.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of sortedEntries) {
                const fullPath = `${path}/${entry.name}`;
                if (entry.isDirectory) {
                    combined += `\n${'#'.repeat(level + 1)} FOLDER: ${entry.name.toUpperCase()}\n`;
                    combined += await this.getRecursiveContent(fullPath, level + 1);
                } else if (entry.name.endsWith('.md')) {
                    const text = await readTextFile(fullPath);
                    combined += `\n\n## ${entry.name.replace('.md', '')}\n\n${text}\n\n---\n`;
                }
            }
        } catch (err) {
            console.error("Gagal rekursi folder:", err);
        }
        return combined;
    }

    async getMergedContent() {
        // Sekarang memanggil fungsi rekursif agar sub-folder ikut terambil
        return await this.getRecursiveContent(this.currentPath);
    }

    // ... (Fungsi handleItemClick, saveContent, goBack, createNewFile, dll tetap sama)
    async handleItemClick(item: any) {
        if (item.is_dir) {
            this.currentPath = `${this.currentPath}/${item.name}`;
            this.activeFileId = null;
            await this.loadFiles();
            return;
        }
        try {
            this.activeFileName = item.name;
            this.activeFileId = item.name;
            const text = await readTextFile(`${this.currentPath}/${item.name}`);
            this.content = text;
        } catch (err) { console.error("Gagal baca file:", err); }
    }

    async saveContent() {
        if (!isTauri || !this.activeFileName) return;
        try {
            await writeTextFile(`${this.currentPath}/${this.activeFileName}`, this.content);
        } catch (err) { alert("Gagal Simpan: " + err); }
    }

    async goBack() {
        if (this.currentPath === this.rootPath) return;
        const parts = this.currentPath.split('/');
        parts.pop();
        this.currentPath = parts.join('/');
        await this.loadFiles();
    }

    async createNewFile(name: string) {
        if (!isTauri || !name) return;
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        try {
            await writeTextFile(`${this.currentPath}/${fileName}`, `# ${name}\n\n`);
            await this.loadFiles();
        } catch (err) { alert(`Gagal Buat File: ${err}`); }
    }

    async createNewFolder(name: string) {
        if (!isTauri || !name) return;
        try {
            await mkdir(`${this.currentPath}/${name}`);
            await this.loadFiles();
        } catch (err) { alert(`Gagal Buat Folder: ${err}`); }
    }

    async renameItemManual(oldName: string, newName: string) {
        if (!isTauri || !newName || newName === oldName) return;
        try {
            await rename(`${this.currentPath}/${oldName}`, `${this.currentPath}/${newName}`);
            if (this.activeFileName === oldName) {
                this.activeFileName = newName;
                this.activeFileId = newName;
            }
            await this.loadFiles();
        } catch (err) { alert("Gagal Rename: " + err); }
    }

    async deleteItemManual(name: string) {
        if (!isTauri) return;
        try {
            await remove(`${this.currentPath}/${name}`, { recursive: true });
            if (this.activeFileName === name) {
                this.content = "";
                this.activeFileName = "";
                this.activeFileId = null;
            }
            await this.loadFiles();
        } catch (err) { alert("Gagal Hapus: " + err); }
    }
}
export const editorStore = new EditorStore();