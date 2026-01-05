// src/lib/stores/editor.svelte.ts
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

// Helper: Cek apakah jalan di Tauri
// @ts-ignore
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

export class EditorStore {
    // State
    activeFileId = $state<string | null>(null);
    activeFileName = $state<string>(''); 
    content = $state<string>('');
    files = $state<any[]>([]);
    
    // Path Management
    rootPath = '/home/priosmilky/Documents/Note'; // Path awal (Home)
    currentPath = $state('/home/priosmilky/Documents/Note'); // Path yang sedang dibuka

    wordCount = $derived(this.content.trim() === '' ? 0 : this.content.trim().split(/\s+/).length);
    charCount = $derived(this.content.length);

    constructor() {
        this.loadFiles();
    }

    // Fungsi membaca isi folder (sesuai currentPath)
    async loadFiles() {
        if (!isTauri) {
            this.files = [{ name: 'Mode Browser (Demo)', id: 'demo', is_dir: false }];
            return;
        }

        try {
            // Baca folder dinamis (bukan hardcoded root lagi)
            const entries = await readDir(this.currentPath);
            
            this.files = entries
                .map(entry => ({
                    name: entry.name,
                    id: entry.name,
                    is_dir: entry.isDirectory
                }))
                .sort((a, b) => {
                    // Folder di atas, File di bawah
                    if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
                    return a.is_dir ? -1 : 1;
                });

        } catch (err) {
            console.error("Gagal baca folder:", err);
            this.content = `# Error\nGagal membuka: ${this.currentPath}\n${err}`;
        }
    }

    // Fungsi Utama: Menangani Klik di Sidebar
    async handleItemClick(item: any) {
        // 1. Jika FOLDER -> Masuk ke dalamnya
        if (item.is_dir) {
            this.currentPath = `${this.currentPath}/${item.name}`; // Update path
            this.activeFileId = null; // Reset seleksi
            await this.loadFiles(); // Reload list
            return;
        }

        // 2. Jika FILE -> Baca isinya
        this.activeFileName = item.name;
        this.activeFileId = item.name;
        this.loadFileContent(item.name);
    }

    // Fungsi Mundur Satu Folder (Back)
    async goBack() {
        // Jangan mundur kalau sudah di root folder
        if (this.currentPath === this.rootPath) return;

        // Potong path terakhir (misal: /Note/FolderA -> /Note)
        const lastSlashIndex = this.currentPath.lastIndexOf('/');
        this.currentPath = this.currentPath.substring(0, lastSlashIndex);
        
        await this.loadFiles();
    }

    // Fungsi baca file .md
    async loadFileContent(fileName: string) {
        try {
            const fullPath = `${this.currentPath}/${fileName}`;
            const text = await readTextFile(fullPath);
            this.content = text;
        } catch (err) {
            console.error("Error baca file:", err);
            this.content = `Error: ${err}`;
        }
    }

    // Fungsi Simpan
    async saveContent() {
        if (!isTauri || !this.activeFileName) return;
        try {
            const fullPath = `${this.currentPath}/${this.activeFileName}`;
            await writeTextFile(fullPath, this.content);
            console.log("Tersimpan:", fullPath);
        } catch (err) {
            console.error("Gagal save:", err);
        }
    }
}

export const editorStore = new EditorStore();