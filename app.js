const { h } = window.App.VDOM;
const { useState, useEffect } = window.App.Hooks;
const { init, addRoute, Link, navbarDynamic } = window.App.Router;

// Supabase client - đảm bảo đã init ở nơi khác hoặc thêm init ở đây nếu cần
const supabase = window.supabase;

function Navbar() {
  return h('nav', null,
    h(Link, { to: '/', children: 'Home' }),
    ' | ',
    h(Link, { to: '/about', children: 'About' }),
    ' | ',
    h(Link, { to: '/tasks', children: 'Quản lý Tasks + PDF' })
  );
}

function Home() {
  return h('div', { className: 'container' },
    h('h1', null, 'Chào mừng đến với Framework Tự Build!'),
    h('p', null, 'Demo CRUD tasks với upload và tải file PDF từ Supabase Storage.'),
    h('p', null, 'Mỗi task có thể đính kèm 1 file PDF.')
  );
}

function About() {
  return h('div', { className: 'container' },
    h('h1', null, 'Giới Thiệu'),
    h('p', null, 'Framework nhẹ + Supabase Database + Storage.')
  );
}

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPdfFile, setNewPdfFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPdfFile, setEditPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, completed, pdf_url, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      setMessage('Lỗi load: ' + (err.message || 'Kết nối thất bại'));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadPdf = async (file, taskId) => {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const fileName = `${taskId}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('task-pdfs')
      .upload(fileName, file, { upsert: true, contentType: 'application/pdf' });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('task-pdfs')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const { data: newTask, error: insertError } = await supabase
        .from('tasks')
        .insert({ title: newTitle.trim() })
        .select()
        .single();

      if (insertError) throw insertError;

      if (newPdfFile) {
        const pdfUrl = await uploadPdf(newPdfFile, newTask.id);
        if (pdfUrl) {
          await supabase.from('tasks').update({ pdf_url: pdfUrl }).eq('id', newTask.id);
        }
      }

      setNewTitle('');
      setNewPdfFile(null);
      fetchTasks();
      setMessage('Thêm task thành công!');
    } catch (err) {
      setMessage('Lỗi thêm: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    setLoading(true);
    try {
      let updates = { title: editTitle.trim() };
      if (editPdfFile) {
        const pdfUrl = await uploadPdf(editPdfFile, editingId);
        if (pdfUrl) updates.pdf_url = pdfUrl;
      }

      const { error } = await supabase.from('tasks').update(updates).eq('id', editingId);
      if (error) throw error;

      setEditingId(null);
      setEditPdfFile(null);
      fetchTasks();
      setMessage('Sửa thành công!');
    } catch (err) {
      setMessage('Lỗi sửa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompleted = async (task) => {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id);
    fetchTasks();
  };

  const deleteTask = async (id) => {
    setLoading(true);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) setMessage('Lỗi xóa: ' + error.message);
    else {
      fetchTasks();
      setMessage('Xóa thành công!');
    }
    setLoading(false);
  };

  return h('div', { className: 'container' },
    h('h1', null, 'Quản lý Tasks + PDF'),

    // Form thêm mới - đẹp hơn
    h('div', { style: { marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '12px' } },
      h('input', {
        type: 'text',
        placeholder: 'Tiêu đề task mới',
        value: newTitle,
        onInput: e => setNewTitle(e.target.value),
        style: { width: '100%', maxWidth: '500px', padding: '10px', marginBottom: '12px' }
      }),
      h('div', { style: { marginBottom: '16px' } },
        h('label', {
          style: { padding: '12px 24px', background: '#28a745', color: 'white', borderRadius: '8px', cursor: 'pointer', display: 'inline-block' }
        },
          newPdfFile ? `✓ ${newPdfFile.name}` : '📎 Chọn PDF (tùy chọn)',
          h('input', { type: 'file', accept: '.pdf', onChange: e => setNewPdfFile(e.target.files[0] || null), style: { display: 'none' } })
        ),
        newPdfFile && h('button', { onClick: () => setNewPdfFile(null), style: { marginLeft: '12px', color: 'red', background: 'none', border: 'none' } }, '✕')
      ),
      h('button', {
        onClick: addTask,
        disabled: loading || !newTitle.trim(),
        style: { padding: '12px 30px', background: newTitle.trim() ? '#007bff' : '#aaa', color: 'white', border: 'none', borderRadius: '8px' }
      }, loading ? 'Đang xử lý...' : '➕ Thêm Task')
    ),

    message && h('p', { style: { color: message.includes('Lỗi') ? 'red' : 'green', fontWeight: 'bold', padding: '10px', borderRadius: '8px', background: message.includes('Lỗi') ? '#ffe6e6' : '#e6ffe6' } }, message),

    loading ? h('p', null, 'Đang tải danh sách...') :
    h('ul', { style: { listStyle: 'none', padding: 0 } },
      tasks.map(task => h('li', { key: task.id, style: { marginBottom: '1rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '12px', background: '#fff' } },
        h('input', { type: 'checkbox', checked: task.completed || false, onChange: () => toggleCompleted(task) }),
        ' ',
        editingId === task.id ? h('div', null,
          h('input', { type: 'text', value: editTitle, onInput: e => setEditTitle(e.target.value), style: { width: '100%', padding: '8px', marginBottom: '8px' } }),
          h('div', { style: { marginBottom: '12px' } },
            h('label', {
              style: { padding: '8px 16px', background: editPdfFile ? '#28a745' : '#6c757d', color: 'white', borderRadius: '6px', cursor: 'pointer', display: 'inline-block' }
            },
              editPdfFile ? `File mới: ${editPdfFile.name}` : 'Chọn PDF thay thế',
              h('input', { type: 'file', accept: '.pdf', onChange: e => setEditPdfFile(e.target.files[0] || null), style: { display: 'none' } })
            ),
            editPdfFile && h('button', { onClick: () => setEditPdfFile(null), style: { marginLeft: '8px', color: 'red', background: 'none', border: 'none' } }, '✕')
          ),
          task.pdf_url && h('p', { style: { fontSize: '0.9em', color: '#555' } }, 'PDF hiện tại: ', h('a', { href: task.pdf_url, target: '_blank' }, 'Xem')),
          h('button', { onClick: saveEdit, disabled: loading, style: { marginRight: '8px' } }, 'Lưu'),
          h('button', { onClick: () => { setEditingId(null); setEditPdfFile(null); } }, 'Hủy')
        ) : h('span', null,
          h('strong', { style: { textDecoration: task.completed ? 'line-through' : 'none', fontSize: '1.2em' } }, task.title),
          task.pdf_url && h('span', { style: { marginLeft: '12px' } },
            ' | ',
            h('a', { href: task.pdf_url, download: true, style: { color: '#007bff' } }, 'Tải PDF'),
            ' ',
            h('a', { href: task.pdf_url, target: '_blank', style: { fontSize: '0.9em', color: '#555' } }, '(xem)')
          )
        ),
        '   ',
        editingId !== task.id && h('button', { onClick: () => { setEditingId(task.id); setEditTitle(task.title); } }, 'Sửa'),
        ' ',
        h('button', { onClick: () => deleteTask(task.id), style: { color: 'red' } }, 'Xóa')
      ))
    )
  );
}

addRoute('/', Home);
addRoute('/about', About);
addRoute('/tasks', Tasks);

navbarDynamic({ navbar: Navbar });
init(document.getElementById('app'), { hash: false });