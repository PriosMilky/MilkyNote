import { readDir, readTextFile, writeTextFile, mkdir, remove, rename } from '@tauri-apps/plugin-fs';

// @ts-ignore
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

export class EditorStore {
    activeFileId = $state<string | null>(null);
    activeFileName = $state<string>(''); 
    content = $state<string>('');
    files = $state<any[]>([]);
    rootPath = '/home/priosmilky/Documents/Note'; 
    currentPath = $state('/home/priosmilky/Documents/Note'); 

    wordCount = $derived(this.content.trim() === '' ? 0 : this.content.trim().split(/\s+/).length);
    charCount = $derived(this.content.length);

    constructor() { this.loadFiles(); }

    async loadFiles() {
        if (!isTauri) return;
        try {
            const entries = await readDir(this.currentPath);
            this.files = entries
                .map(entry => ({ name: entry.name, id: entry.name, is_dir: entry.isDirectory }))
                .sort((a, b) => {
                    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                });
        } catch (err) { console.error(err); }
    }

    async createNewFile(name: string) {
        if (!isTauri || !name) return;
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        await writeTextFile(`${this.currentPath}/${fileName}`, `# ${name}\n\n`);
        await this.loadFiles();
    }

    async createNewFolder(name: string) {
        if (!isTauri || !name) return;
        await mkdir(`${this.currentPath}/${name}`);
        await this.loadFiles();
    }

    async renameItem(oldName: string) {
        const newName = prompt("Masukkan nama baru:", oldName);
        if (!newName || newName === oldName) return;
        await rename(`${this.currentPath}/${oldName}`, `${this.currentPath}/${newName}`);
        if (this.activeFileName === oldName) {
            this.activeFileName = newName;
            this.activeFileId = newName;
        }
        await this.loadFiles();
    }

    async deleteItem(name: string) {
        if (!confirm(`Hapus "${name}"?`)) return;
        await remove(`${this.currentPath}/${name}`, { recursive: true });
        if (this.activeFileName === name) {
            this.content = ""; this.activeFileName = ""; this.activeFileId = null;
        }
        await this.loadFiles();
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

    async handleItemClick(item: any) {
        if (item.is_dir) {
            this.currentPath = `${this.currentPath}/${item.name}`;
            this.activeFileId = null;
            await this.loadFiles();
        } else {
            this.activeFileName = item.name;
            this.activeFileId = item.name;
            this.loadFileContent(item.name);
        }
    }

    async goBack() {
        if (this.currentPath === this.rootPath) return;
        const lastSlashIndex = this.currentPath.lastIndexOf('/');
        this.currentPath = this.currentPath.substring(0, lastSlashIndex);
        await this.loadFiles();
    }

    async loadFileContent(fileName: string) {
        const text = await readTextFile(`${this.currentPath}/${fileName}`);
        this.content = text;
    }

    async saveContent() {
        if (isTauri && this.activeFileName) {
            await writeTextFile(`${this.currentPath}/${this.activeFileName}`, this.content);
        }
    }
}
export const editorStore = new EditorStore();