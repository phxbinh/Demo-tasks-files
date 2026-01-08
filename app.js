const { h } = window.App.VDOM;
const { useState, useEffect } = window.App.Hooks;
const { init, addRoute, Link, Outlet, navbarDynamic } = window.App.Router;

// Giả sử supabase client đã được khởi tạo toàn cục (window.supabase hoặc import)
const supabase = window.supabase; // Đảm bảo bạn đã init supabase trước

// Navbar
function Navbar() {
  return h('nav', null,
    h(Link, { to: '/', children: 'Home' }),
    ' | ',
    h(Link, { to: '/about', children: 'About' }),
    ' | ',
    h(Link, { to: '/tasks', children: 'Quản lý Tasks (CRUD)' })
  );
}

function Home() {
  return h('div', { className: 'container' },
    h('h1', null, 'Chào mừng đến với Framework Tự Build!'),
    h('p', null, 'Demo CRUD tasks với upload PDF.'),
    h('p', null, 'Mỗi task có thể đính kèm 1 file PDF.')
  );
}

function About() {
  return h('div', { className: 'container' },
    h('h1', null, 'Giới Thiệu'),
    h('p', null, 'Framework frontend nhẹ + Supabase Storage cho file PDF.')
  );
}

// Component Tasks - Có upload + download PDF
function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPdfFile, setNewPdfFile] = useState(null); // File chọn để upload khi thêm mới
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPdfFile, setEditPdfFile] = useState(null); // File mới khi sửa
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, completed, pdf_url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage('Lỗi load: ' + error.message);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  // Upload PDF và trả về public URL
  const uploadPdf = async (file, taskId) => {
    if (!file) return null;

    // Tên file duy nhất: taskId + timestamp + ext
    const ext = file.name.split('.').pop();
    const fileName = `${taskId}_${Date.now()}.${ext}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from('task-pdfs')           // <<< Tạo bucket này trong Supabase Storage
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // Lấy public URL
    const { data: urlData } = supabase.storage
      .from('task-pdfs')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Add task mới (có thể có PDF)
  const addTask = async () => {
    if (!newTitle.trim()) return;

    setLoading(true);
    setMessage('');

    try {
      // Bước 1: Tạo task trước để lấy ID
      const { data: newTask, error: insertError } = await supabase
        .from('tasks')
        .insert({ title: newTitle.trim() })
        .select()
        .single();

      if (insertError) throw insertError;

      let pdfUrl = null;
      if (newPdfFile) {
        pdfUrl = await uploadPdf(newPdfFile, newTask.id);
      }

      // Bước 2: Nếu có PDF thì update lại pdf_url
      if (pdfUrl) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ pdf_url: pdfUrl })
          .eq('id', newTask.id);

        if (updateError) throw updateError;
      }

      setNewTitle('');
      setNewPdfFile(null);
      fetchTasks();
      setMessage('Thêm task thành công!');
    } catch (err) {
      setMessage('Lỗi thêm task: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update task (title + có thể thay PDF mới)
  const saveEdit = async () => {
    if (!editTitle.trim()) return;

    setLoading(true);
    try {
      let pdfUrl = tasks.find(t => t.id === editingId)?.pdf_url || null;

      if (editPdfFile) {
        pdfUrl = await uploadPdf(editPdfFile, editingId);
      }

      const updates = { title: editTitle.trim() };
      if (pdfUrl) updates.pdf_url = pdfUrl;

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', editingId);

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

  // Toggle completed
  const toggleCompleted = async (task) => {
    await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);
    fetchTasks();
  };

  // Delete task
  const deleteTask = async (id) => {
    setLoading(true);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      setMessage('Lỗi xóa: ' + error.message);
    } else {
      fetchTasks();
      setMessage('Xóa thành công!');
    }
    setLoading(false);
  };

  // UI cho mỗi task
  const TaskItem = (task) => {
    const isEditing = editingId === task.id;

    return h('li', { key: task.id, style: { marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' } },
      h('input', {
        type: 'checkbox',
        checked: task.completed || false,
        onChange: () => toggleCompleted(task)
      }),
      ' ',
      isEditing ? h('div', null,
        h('input', {
          type: 'text',
          value: editTitle,
          onInput: e => setEditTitle(e.target.value),
          style: { width: '300px', marginBottom: '8px' }
        }),
        h('br'),
        h('input', {
          type: 'file',
          accept: '.pdf',
          onChange: e => setEditPdfFile(e.target.files[0] || null)
        }),
        h('p', { style: { fontSize: '0.9em', color: '#555' } },
          task.pdf_url ? 'PDF hiện tại: ' : 'Chưa có PDF',
          task.pdf_url && h('a', { href: task.pdf_url, target: '_blank', style: { marginLeft: '8px' } }, 'Xem')
        ),
        h('div', { style: { marginTop: '8px' } },
          h('button', { onClick: saveEdit, disabled: loading }, 'Lưu'),
          ' ',
          h('button', { onClick: () => { setEditingId(null); setEditPdfFile(null); } }, 'Hủy')
        )
      ) : h('span', null,
        h('strong', { style: { textDecoration: task.completed ? 'line-through' : 'none' } }, task.title),
        task.pdf_url && h('span', null,
          ' | ',
          h('a', {
            href: task.pdf_url,
            download: true,               // Gợi ý browser tải về thay vì mở
            style: { color: 'blue', textDecoration: 'underline' }
          }, 'Tải PDF về'),
          ' ',
          h('a', { href: task.pdf_url, target: '_blank', style: { fontSize: '0.8em' } }, '(xem)')
        )
      ),
      '   ',
      !isEditing && h('button', { onClick: () => { setEditingId(task.id); setEditTitle(task.title); } }, 'Sửa'),
      ' ',
      h('button', { onClick: () => deleteTask(task.id), style: { color: 'red' } }, 'Xóa')
    );
  };

  return h('div', { className: 'container' },
    h('h1', null, 'Quản lý Tasks + PDF'),

    // Form thêm task mới
    h('div', { style: { marginBottom: '2rem', padding: '1rem', border: '1px dashed #aaa', borderRadius: '8px' } },
      h('input', {
        type: 'text',
        placeholder: 'Tiêu đề task mới',
        value: newTitle,
        onInput: e => setNewTitle(e.target.value),
        disabled: loading,
        style: { width: '400px', marginRight: '8px' }
      }),
      h('br'),
      h('input', {
        type: 'file',
        accept: '.pdf',
        onChange: e => setNewPdfFile(e.target.files[0] || null)
      }),
      newPdfFile && h('span', { style: { marginLeft: '8px', color: 'green' } }, `Đã chọn: ${newPdfFile.name}`),
      h('br'),
      h('button', {
        onClick: addTask,
        disabled: loading || !newTitle.trim()
      }, loading ? 'Đang xử lý...' : 'Thêm Task')
    ),

    message && h('p', { style: { color: message.includes('Lỗi') ? 'red' : 'green', fontWeight: 'bold' } }, message),

    loading && !tasks.length ? h('p', null, 'Đang tải...') :
      h('ul', { style: { listStyle: 'none', padding: 0 } },
        ...tasks.map(TaskItem)
      )
  );
}

// Routes
addRoute('/', Home);
addRoute('/about', About);
addRoute('/tasks', Tasks);

navbarDynamic({ navbar: Navbar });
init(document.getElementById('app'), { hash: false });