// The message editor: formatted text with headings, lists, links and pictures, plus personal
// touches (merge tags such as {{first_name}}). The HTML button shows and edits the code itself.
import { useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered,
  Minus, Quote, Redo2, Strikethrough, Underline, Undo2, Unlink,
} from 'lucide-react';
import { MERGE_TAGS } from '../../shared/render.js';
import { Dialog } from '../ui.jsx';

const INSERTS = [
  { value: '{{first_name|there}}', label: 'First name, or “there”' },
  ...MERGE_TAGS.filter((t) => t.tag !== 'subject').map((t) => ({ value: `{{${t.tag}}}`, label: t.label })),
];

function Tool({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className={active ? 'tool tool-on' : 'tool'}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function LinkDialog({ open, initial, onSave, onClose }) {
  const [url, setUrl] = useState(initial);
  return (
    <Dialog open={open} onClose={onClose} title="Link">
      <form onSubmit={(e) => { e.preventDefault(); onSave(url.trim()); }}>
        <label className="field">
          <span className="field-label">Web address</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        </label>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary">Save link</button>
        </div>
      </form>
    </Dialog>
  );
}

function ImageDialog({ open, onSave, onClose }) {
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Picture">
      <form onSubmit={(e) => { e.preventDefault(); if (src.trim()) onSave({ src: src.trim(), alt: alt.trim() }); }}>
        <label className="field">
          <span className="field-label">Picture’s web address</span>
          <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="https://example.com/photo.jpg" type="url" required />
          <span className="field-hint">The picture has to be online already (on your website, for example), so every reader’s mail app can load it.</span>
        </label>
        <label className="field">
          <span className="field-label">Description</span>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="What the picture shows" />
          <span className="field-hint">Shown when pictures are turned off, and read aloud by screen readers.</span>
        </label>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary">Add picture</button>
        </div>
      </form>
    </Dialog>
  );
}

const safeUrl = (url) => {
  if (!url) return '';
  if (/^(https?:|mailto:|tel:)/i.test(url) || url.startsWith('{{')) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';
  return url.includes('@') && !url.includes('/') ? `mailto:${url}` : `https://${url}`;
};

export default function Editor({ value, onChange, label = 'Message' }) {
  const [source, setSource] = useState(null);
  const [dialog, setDialog] = useState(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    editorProps: { attributes: { class: 'editor-content', 'aria-label': label, 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  if (!editor || !s) return null;
  const run = () => editor.chain().focus();

  function setBlock(kind) {
    if (kind === 'p') run().setParagraph().run();
    else run().toggleHeading({ level: Number(kind[1]) }).run();
  }

  function saveLink(url) {
    const href = safeUrl(url);
    if (!href) run().extendMarkRange('link').unsetLink().run();
    else if (editor.state.selection.empty && !s.link) run().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href } }] }).run();
    else run().extendMarkRange('link').setLink({ href }).run();
    setDialog(null);
  }

  function toggleSource() {
    if (source === null) setSource(editor.getHTML());
    else {
      editor.commands.setContent(source, { emitUpdate: true });
      setSource(null);
    }
  }

  return (
    <div className="editor">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        <select className="tool-select" aria-label="Text style" value={s.block} onChange={(e) => setBlock(e.target.value)} disabled={source !== null}>
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <span className="tool-group">
          <Tool label="Bold" active={s.bold} disabled={source !== null} onClick={() => run().toggleBold().run()}><Bold size={17} /></Tool>
          <Tool label="Italic" active={s.italic} disabled={source !== null} onClick={() => run().toggleItalic().run()}><Italic size={17} /></Tool>
          <Tool label="Underline" active={s.underline} disabled={source !== null} onClick={() => run().toggleUnderline().run()}><Underline size={17} /></Tool>
          <Tool label="Strikethrough" active={s.strike} disabled={source !== null} onClick={() => run().toggleStrike().run()}><Strikethrough size={17} /></Tool>
        </span>
        <span className="tool-group">
          <Tool label="Bulleted list" active={s.bullet} disabled={source !== null} onClick={() => run().toggleBulletList().run()}><List size={17} /></Tool>
          <Tool label="Numbered list" active={s.ordered} disabled={source !== null} onClick={() => run().toggleOrderedList().run()}><ListOrdered size={17} /></Tool>
          <Tool label="Quote" active={s.quote} disabled={source !== null} onClick={() => run().toggleBlockquote().run()}><Quote size={17} /></Tool>
          <Tool label="Divider line" disabled={source !== null} onClick={() => run().setHorizontalRule().run()}><Minus size={17} /></Tool>
        </span>
        <span className="tool-group">
          <Tool label="Align left" active={s.left} disabled={source !== null} onClick={() => run().setTextAlign('left').run()}><AlignLeft size={17} /></Tool>
          <Tool label="Center" active={s.center} disabled={source !== null} onClick={() => run().setTextAlign('center').run()}><AlignCenter size={17} /></Tool>
          <Tool label="Align right" active={s.right} disabled={source !== null} onClick={() => run().setTextAlign('right').run()}><AlignRight size={17} /></Tool>
        </span>
        <span className="tool-group">
          <Tool label="Link" active={s.link} disabled={source !== null} onClick={() => setDialog('link')}><LinkIcon size={17} /></Tool>
          {s.link && <Tool label="Remove link" disabled={source !== null} onClick={() => run().extendMarkRange('link').unsetLink().run()}><Unlink size={17} /></Tool>}
          <Tool label="Picture" disabled={source !== null} onClick={() => setDialog('image')}><ImageIcon size={17} /></Tool>
        </span>
        <select
          className="tool-select"
          aria-label="Insert a personal touch"
          value=""
          disabled={source !== null}
          onChange={(e) => { if (e.target.value) run().insertContent(e.target.value).run(); }}
        >
          <option value="">Insert…</option>
          {INSERTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
        <span className="tool-group tool-end">
          <Tool label="Undo" disabled={source !== null || !s.canUndo} onClick={() => run().undo().run()}><Undo2 size={17} /></Tool>
          <Tool label="Redo" disabled={source !== null || !s.canRedo} onClick={() => run().redo().run()}><Redo2 size={17} /></Tool>
          <Tool label={source === null ? 'Edit the HTML' : 'Back to the editor'} active={source !== null} onClick={toggleSource}><Code size={17} /></Tool>
        </span>
      </div>
      {source === null ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="editor-source">
          <textarea className="code" value={source} onChange={(e) => { setSource(e.target.value); onChange(e.target.value); }} spellCheck="false" aria-label="Message HTML" />
          <p className="field-hint">Edit the HTML, then press the code button again to go back. Headings, paragraphs, lists, links, quotes and pictures are kept; anything else is simplified.</p>
        </div>
      )}
      {dialog === 'link' && <LinkDialog open initial={editor.getAttributes('link').href || ''} onSave={saveLink} onClose={() => setDialog(null)} />}
      {dialog === 'image' && <ImageDialog open onSave={(img) => { run().setImage(img).run(); setDialog(null); }} onClose={() => setDialog(null)} />}
    </div>
  );
}
