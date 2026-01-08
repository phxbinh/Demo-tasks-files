const { h } = window.App.VDOM;
const { useState, useEffect } = window.App.Hooks;
const { init, addRoute, Link, navbarDynamic } = window.App.Router;

// Giả sử supabase client đã được khởi tạo toàn cục
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
    h('p', null, 'Demo CRUD tasks với upload và download file PDF từ Supabase Storage.'),
    h('p', null, 'Mỗi task có thể đính kèm 1 file PDF.')
  );
}

function About() {
  return h('div', { className: 'container' },
    h('h1', null, 'Giới Thiệu'),
    h('p', null, 'Framework frontend nhẹ tự build + Supabase (Database + Storage).')
  );
}

// Component Tasks với upload/download PDF
function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPdfFile, setNewPdfFile] = useState(null); // File khi thêm mới
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPdfFile, setEditPdfFile] = useState(null); // File mới khi sửa
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

/*
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
*/
const fetchTasks = async () => {
  setLoading(true);
  setMessage('');

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, completed, pdf_url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      setMessage('Lỗi load: ' + error.message);
      setTasks([]);
    } else {
      console.log('Load thành công:', data);
      setTasks(data || []);
    }
  } catch (err) {
    console.error('Lỗi bất ngờ:', err);
    setMessage('Lỗi kết nối Supabase');
    setTasks([]);
  } finally {
    // <<< Dòng quan trọng nhất: luôn tắt loading
    setLoading(false);
  }
};


  // Upload file PDF → trả về public URL
  const uploadPdf = async (file, taskId) => {
    if (!file) return null;

    const ext = file.name.split('.').pop();
    const fileName = `${taskId}_${Date.now()}.${ext}`;
    const filePath = fileName;

    const { data, error } = await supabase.storage
      .from('task-pdfs') // <<< Đảm bảo bucket này tồn tại và PUBLIC
      .upload(filePath, file, {
        upsert: true,
        contentType: 'application/pdf' // Quan trọng để browser hiển thị đúng
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('task-pdfs')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Thêm task mới (có thể có PDF)
  const addTask = async () => {
    if (!newTitle.trim()) return;

    setLoading(true);
    setMessage('');

    try {
      // Tạo task trước để lấy ID
      const { data: newTask, error: insertError } = await supabase
        .from('tasks')
        .insert({ title: newTitle.trim() })
        .select()
        .single();

      if (insertError) throw insertError;

      // Nếu có file PDF → upload và update url
      if (newPdfFile) {
        const pdfUrl = await uploadPdf(newPdfFile, newTask.id);
        if (pdfUrl) {
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ pdf_url: pdfUrl })
            .eq('id', newTask.id);
          if (updateError) throw updateError;
        }
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

  // Lưu sửa task (title + thay PDF nếu có)
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

  return h('div', { className: 'container' },
    h('h1', null, 'Quản lý Tasks + PDF'),

    // Form thêm task mới
    h('div', {
      style: {
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }
    },
      h('h3', { style: { marginTop: 0 } }, 'Thêm task mới'),
      h('input', {
        type: 'text',
        placeholder: 'Nhập tiêu đề task...',
        value: newTitle,
        onInput: e => setNewTitle(e.target.value),
        disabled: loading,
        style: { width: '100%', maxWidth: '500px', padding: '10px', marginBottom: '12px', fontSize: '1.1em' }
      }),
      h('div', { style: { marginBottom: '16px' } },
        h('label', {
          style: {
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }
        },
          newPdfFile ? `✓ Đã chọn: ${newPdfFile.name}` : '📎 Chọn file PDF (tùy chọn)',
          h('input', {
            type: 'file',
            accept: '.pdf',
            onChange: e => setNewPdfFile(e.target.files[0] || null),
            style: { display: 'none' }
          })
        ),
        newPdfFile && h('button', {
          onClick: () => setNewPdfFile(null),
          style: { marginLeft: '12px', background: 'none', border: 'none', color: 'red', fontSize: '1.4em', cursor: 'pointer' }
        }, '✕')
      ),
      h('button', {
        onClick: addTask,
        disabled: loading || !newTitle.trim(),
        style: {
          padding: '12px 30px',
          fontSize: '1.1em',
          backgroundColor: newTitle.trim() ? '#007bff' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }
      }, loading ? 'Đang xử lý...' : '➕ Thêm Task')
    ),

    // Thông báo
    message && h('p', {
      style: {
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: message.includes('Lỗi') ? '#f8d7da' : '#d4edda',
        color: message.includes('Lỗi') ? '#721c24' : '#155724',
        fontWeight: 'bold'
      }
    }, message),

    // Danh sách tasks
    loading && !tasks.length ? h('p', null, 'Đang tải danh sách...') :
    h('ul', { style: { listStyle: 'none', padding: 0 } },
      tasks.map(task => h('li', {
        key: task.id,
        style: { marginBottom: '1rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '12px', backgroundColor: '#fff' }
      },
        h('input', {
          type: 'checkbox',
          checked: task.completed || false,
          onChange: () => toggleCompleted(task)
        }),
        ' ',

        // Hiển thị hoặc chỉnh sửa
        editingId === task.id ? h('div', { style: { display: 'inline-block', width: '70%' } },
          h('input', {
            type: 'text',
            value: editTitle,
            onInput: e => setEditTitle(e.target.value),
            style: { width: '100%', padding: '8px', marginBottom: '8px' }
          }),
          h('div', { style: { marginBottom: '12px' } },
            h('label', {
              style: {
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: editPdfFile ? '#28a745' : '#6c757d',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer'
              }
            },
              editPdfFile ? `File mới: ${editPdfFile.name}` : 'Chọn PDF thay thế',
              h('input', {
                type: 'file',
                accept: '.pdf',
                onChange: e => setEditPdfFile(e.target.files[0] || null),
                style: { display: 'none' }
              })
            ),
            editPdfFile && h('button', {
              onClick: () => setEditPdfFile(null),
              style: { marginLeft: '8px', background: 'none', border: 'none', color: 'red' }
            }, '✕')
          ),
          task.pdf_url && h('p', { style: { fontSize: '0.9em', color: '#555' } },
            'PDF hiện tại: ',
            h('a', { href: task.pdf_url, target: '_blank' }, 'Xem online')
          ),
          h('button', { onClick: saveEdit, disabled: loading, style: { marginRight: '8px' } }, 'Lưu'),
          h('button', { onClick: () => { setEditingId(null); setEditPdfFile(null); } }, 'Hủy')
        ) : h('span', null,
          h('strong', { style: { textDecoration: task.completed ? 'line-through' : 'none', fontSize: '1.2em' } }, task.title),
          task.pdf_url && h('span', { style: { marginLeft: '12px' } },
            ' | ',
            h('a', { href: task.pdf_url, download: true, style: { color: '#007bff', fontWeight: 'bold' } }, 'Tải PDF'),
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

// Routes
addRoute('/', Home);
addRoute('/about', About);
addRoute('/tasks', Tasks);

navbarDynamic({ navbar: Navbar });
init(document.getElementById('app'), { hash: false });