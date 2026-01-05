import { readDir, readTextFile, writeTextFile, mkdir, remove, rename } from '@tauri-apps/plugin-fs';
import { type } from '@tauri-apps/plugin-os';

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
            console.log("Platform terdeteksi:", platformName);

            if (platformName === 'android') {
                this.rootPath = '/storage/emulated/0/MilkyNote_Sync';
            } else {
                this.rootPath = '/home/priosmilky/Documents/Note';
            }

            this.currentPath = this.rootPath;
            console.log("Path terpilih:", this.currentPath);
            
            // Jeda sedikit agar plugin siap
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
            console.log("Membaca folder:", this.currentPath);
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
            console.log("File berhasil dimuat:", this.files.length);
        } catch (err) { 
            console.error("Gagal baca folder:", err);
        }
    }

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
            this.content = await readTextFile(`${this.currentPath}/${item.name}`);
        } catch (err) { console.error("Gagal baca file:", err); }
    }

    async saveContent() {
        if (!isTauri || !this.activeFileName) return;
        try {
            await writeTextFile(`${this.currentPath}/${this.activeFileName}`, this.content);
        } catch (err) { console.error("Gagal simpan:", err); }
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
        } catch (err) { console.error("Gagal buat file:", err); }
    }

    async createNewFolder(name: string) {
        if (!isTauri || !name) return;
        try {
            await mkdir(`${this.currentPath}/${name}`);
            await this.loadFiles();
        } catch (err) { console.error("Gagal buat folder:", err); }
    }

    async renameItem(oldName: string) {
        if (!isTauri) return;
        const newName = prompt("Nama baru:", oldName);
        if (!newName || newName === oldName) return;
        try {
            await rename(`${this.currentPath}/${oldName}`, `${this.currentPath}/${newName}`);
            if (this.activeFileName === oldName) {
                this.activeFileName = newName;
                this.activeFileId = newName;
            }
            await this.loadFiles();
        } catch (err) { console.error("Gagal rename:", err); }
    }

    async deleteItem(name: string) {
        if (!isTauri || !confirm(`Hapus "${name}"?`)) return;
        try {
            await remove(`${this.currentPath}/${name}`, { recursive: true });
            if (this.activeFileName === name) {
                this.content = "";
                this.activeFileName = "";
                this.activeFileId = null;
            }
            await this.loadFiles();
        } catch (err) { console.error("Gagal hapus:", err); }
    }

    async getMergedContent() {
        if (!isTauri) return this.content;
        try {
            const entries = await readDir(this.currentPath);
            const mdFiles = entries
                .filter(e => !e.isDirectory && e.name.endsWith('.md'))
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            let merged = "";
            for (const f of mdFiles) {
                const text = await readTextFile(`${this.currentPath}/${f.name}`);
                merged += `\n\n# ${f.name.replace('.md', '')}\n\n${text}\n\n---\n`;
            }
            return merged;
        } catch (err) { return this.content; }
    }
}
export const editorStore = new EditorStore();