import React, { useMemo, useRef, useState } from 'react';
import { X, Upload, FileText, CheckCircle, XCircle, Loader2, Download, AlertTriangle } from 'lucide-react';
import { Syllabus } from '../../types';
import { getGradesBySyllabus } from '../../lib/curriculum';

// Admin CSV import of students: pick a file → preview with per-row validation →
// import. Existing emails are updated, new emails are created (temporary
// password emailed). No CSV library — the parser below handles quoted fields.

export const IMPORT_HEADERS = ['name', 'email', 'grade', 'syllabus', 'birthday', 'parentName', 'parentPhone', 'parentEmail'] as const;
type ImportRow = Record<(typeof IMPORT_HEADERS)[number], string>;

interface Props {
    token: string;
    onClose: () => void;
    onImported: () => void;
}

// RFC-4180-ish parser: handles quotes, escaped quotes (""), commas/newlines inside quotes, CRLF.
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    const src = text.replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && src[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(v => v.trim() !== '')) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(v => v.trim() !== '')) rows.push(row);
    return rows;
};

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const SYLLABI = Object.values(Syllabus) as string[];

export const StudentImportModal: React.FC<Props> = ({ token, onClose, onImported }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<ImportRow[]>([]);
    const [parseError, setParseError] = useState('');
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ created: number; updated: number; failed: Array<{ row: number; email: string; reason: string }>; details: Array<{ row: number; email: string; action: string; emailSent?: boolean }> } | null>(null);

    const handleFile = async (file: File) => {
        setParseError(''); setResult(null); setRows([]); setFileName(file.name);
        const text = await file.text();
        const table = parseCsv(text);
        if (table.length < 2) { setParseError('The file has no data rows.'); return; }
        const header = table[0].map(h => h.trim().replace(/^"|"$/g, ''));
        const idx: Partial<Record<(typeof IMPORT_HEADERS)[number], number>> = {};
        for (const key of IMPORT_HEADERS) {
            const i = header.findIndex(h => h.toLowerCase() === key.toLowerCase());
            if (i >= 0) idx[key] = i;
        }
        if (idx.email === undefined) { setParseError('Missing required "email" column. Download the template to see the expected headers.'); return; }
        setRows(table.slice(1).map(cells => {
            const r = {} as ImportRow;
            for (const key of IMPORT_HEADERS) r[key] = idx[key] !== undefined ? (cells[idx[key]!] ?? '').trim() : '';
            return r;
        }));
    };

    // Client-side preview validation mirrors the server rules (server is authoritative).
    const validation = useMemo(() => rows.map(r => {
        const problems: string[] = [];
        if (!emailOk(r.email)) problems.push('invalid email');
        if (r.syllabus && !SYLLABI.includes(r.syllabus)) problems.push('unknown syllabus');
        if (r.grade) {
            if (!r.syllabus) problems.push('grade needs a syllabus');
            else if (SYLLABI.includes(r.syllabus)) {
                const g = getGradesBySyllabus(r.syllabus as Syllabus);
                const all = [...g.primary, ...g.secondary, ...(g.advanced || [])] as string[];
                if (!all.includes(r.grade)) problems.push('grade not valid for syllabus');
            }
        }
        if (r.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(r.birthday)) problems.push('birthday must be YYYY-MM-DD');
        if (r.parentEmail && !emailOk(r.parentEmail)) problems.push('invalid parent email');
        return problems;
    }), [rows]);
    const invalidCount = validation.filter(p => p.length > 0).length;

    const downloadTemplate = () => {
        const sample = [IMPORT_HEADERS.join(','), 'Aisha Kumar,aisha@example.com,Grade 2,Carnatic Music,2015-06-11,Priya Kumar,012-345 6789,priya@example.com'].join('\r\n');
        const url = URL.createObjectURL(new Blob(['﻿' + sample], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = 'akshara-student-import-template.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const runImport = async () => {
        setImporting(true);
        try {
            const res = await fetch('/api/admin/users/import', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setParseError(data.error || 'Import failed'); }
            else { setResult(data); onImported(); }
        } catch {
            setParseError('Import failed — check your connection.');
        }
        setImporting(false);
    };

    return (
        <div className="fixed inset-0 z-[150] flex justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl m-auto p-6 md:p-8 relative">
                <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-2.5 rounded-full text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/5"><X size={22} /></button>

                <div className="flex items-center gap-3 mb-1">
                    <Upload className="text-brand-blue" size={24} />
                    <h3 className="font-display font-bold text-xl text-brand-dark">Import Students (CSV)</h3>
                </div>
                <p className="text-sm text-brand-dark/50 mb-5">
                    Rows with an existing email <b>update</b> that account; new emails <b>create</b> a student and email them a temporary password.
                    Columns: <span className="font-mono text-xs">{IMPORT_HEADERS.join(', ')}</span> (only <b>email</b> is required; <b>name</b> is required for new students).
                </p>

                {!result && (
                    <>
                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <button onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-brand-dark/15 rounded-2xl py-4 text-sm font-bold text-brand-dark/60 hover:border-brand-blue hover:text-brand-blue transition-colors">
                                <FileText size={18} /> {fileName ? `Chosen: ${fileName} — click to change` : 'Choose CSV file'}
                            </button>
                            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }} />
                            <button onClick={downloadTemplate} className="flex items-center justify-center gap-2 bg-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand-dark/70 hover:bg-gray-200">
                                <Download size={16} /> Template
                            </button>
                        </div>

                        {parseError && (
                            <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-bold mb-4"><XCircle size={16} /> {parseError}</div>
                        )}

                        {rows.length > 0 && (
                            <>
                                <div className="flex flex-wrap items-center gap-3 text-sm font-bold mb-2">
                                    <span className="text-brand-dark">{rows.length} rows</span>
                                    {invalidCount > 0
                                        ? <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={14} /> {invalidCount} with problems (they will be skipped)</span>
                                        : <span className="flex items-center gap-1 text-brand-green"><CheckCircle size={14} /> all rows look valid</span>}
                                </div>
                                <div className="max-h-72 overflow-auto rounded-2xl border border-brand-dark/10 mb-4">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="text-left p-2 font-black text-brand-dark/40">#</th>
                                                {IMPORT_HEADERS.map(h => <th key={h} className="text-left p-2 font-black text-brand-dark/40 whitespace-nowrap">{h}</th>)}
                                                <th className="text-left p-2 font-black text-brand-dark/40">Check</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r, i) => (
                                                <tr key={i} className={validation[i].length ? 'bg-amber-50/60' : ''}>
                                                    <td className="p-2 text-brand-dark/40">{i + 1}</td>
                                                    {IMPORT_HEADERS.map(h => <td key={h} className="p-2 whitespace-nowrap max-w-[12rem] truncate">{r[h]}</td>)}
                                                    <td className="p-2 whitespace-nowrap">{validation[i].length ? <span className="text-amber-700 font-bold">{validation[i].join(', ')}</span> : <span className="text-brand-green font-bold">ok</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button onClick={runImport} disabled={importing || rows.length === invalidCount} className="w-full flex items-center justify-center gap-2 bg-brand-blue text-white rounded-2xl py-3.5 text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
                                    {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} Import {rows.length - invalidCount} valid row{rows.length - invalidCount === 1 ? '' : 's'}
                                </button>
                            </>
                        )}
                    </>
                )}

                {result && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-brand-green/10 rounded-2xl p-4"><p className="font-display font-bold text-3xl text-brand-green">{result.created}</p><p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40">Created</p></div>
                            <div className="bg-brand-blue/10 rounded-2xl p-4"><p className="font-display font-bold text-3xl text-brand-blue">{result.updated}</p><p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40">Updated</p></div>
                            <div className="bg-red-50 rounded-2xl p-4"><p className="font-display font-bold text-3xl text-red-500">{result.failed.length}</p><p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40">Failed</p></div>
                        </div>
                        {result.details.some(d => d.action === 'created' && d.emailSent === false) && (
                            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-xl px-4 py-3 text-sm font-bold"><AlertTriangle size={16} /> Some welcome emails could not be sent — those students will need a password reset to log in.</div>
                        )}
                        {result.failed.length > 0 && (
                            <div className="max-h-56 overflow-auto rounded-2xl border border-brand-dark/10">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 sticky top-0"><tr><th className="text-left p-2 font-black text-brand-dark/40">Row</th><th className="text-left p-2 font-black text-brand-dark/40">Email</th><th className="text-left p-2 font-black text-brand-dark/40">Reason</th></tr></thead>
                                    <tbody>{result.failed.map((f, i) => <tr key={i}><td className="p-2">{f.row}</td><td className="p-2">{f.email || '—'}</td><td className="p-2 text-red-600 font-bold">{f.reason}</td></tr>)}</tbody>
                                </table>
                            </div>
                        )}
                        <button onClick={onClose} className="w-full bg-brand-dark text-white rounded-2xl py-3.5 text-sm font-bold hover:bg-brand-dark/90">Done</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentImportModal;
