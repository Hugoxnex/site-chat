const express = require('express');
const socketio = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
const io = socketio(server);

// Configurações
const SECRET_KEY = 'sua_chave_secreta_super_forte_123!';
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

// Banco de dados
const db = new sqlite3.Database('./database.db');

// Criar/atualizar tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    name TEXT,
    status TEXT DEFAULT 'offline',
    reset_token TEXT,
    reset_expires INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    chat_id TEXT,
    sender TEXT,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS active_chats (
    chat_id TEXT PRIMARY KEY,
    user_id TEXT,
    agent_id TEXT,
    status TEXT DEFAULT 'waiting'
  )`);

  // Criar admin padrão se não existir
  db.get("SELECT COUNT(*) as count FROM agents", (err, row) => {
    if (row.count === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO agents (username, password, name) VALUES (?, ?, ?)", 
        ['admin', hashedPassword, 'Administrador']);
    }
  });
});

// Middleware de autenticação
function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// Rotas públicas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/forgot-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Rotas protegidas
app.get('/analista.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analista.html'));
});

app.get('/admin.html', authenticateToken, (req, res) => {
  if (req.user.username !== 'admin') {
    return res.status(403).send('Acesso negado');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API - Login
app.post('/api/login', express.json(), async (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT * FROM agents WHERE username = ?", [username], async (err, agent) => {
    if (!agent || !(await bcrypt.compare(password, agent.password))) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const token = jwt.sign(
      { id: agent.id, username: agent.username, name: agent.name },
      SECRET_KEY,
      { expiresIn: '8h' }
    );
    
    // Atualizar status
    db.run("UPDATE agents SET status = 'available' WHERE id = ?", [agent.id]);
    
    res.cookie('token', token, { httpOnly: true });
    res.json({ success: true });
  });
});

// API - Cadastro de analistas (apenas admin)
app.post('/api/register', authenticateToken, express.json(), async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ 
        error: 'Todos os campos são obrigatórios',
        fields: { name: !name, username: !username, password: !password }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    // Verifica se usuário já existe
    const agentExists = await new Promise((resolve) => {
      db.get("SELECT id FROM agents WHERE username = ?", [username], (err, row) => {
        resolve(!!row);
      });
    });

    if (agentExists) {
      return res.status(409).json({ error: 'Nome de usuário já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO agents (name, username, password) VALUES (?, ?, ?)",
        [name, username, hashedPassword],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    res.status(201).json({ 
      success: true,
      message: 'Analista cadastrado com sucesso'
    });

  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ... (outras rotas API existentes)

// Socket.io (lógica existente)
io.on('connection', (socket) => {
  // ... (código existente)
});

// Inicia o servidor
process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});
// Adicione este middleware ANTES das rotas para tratamento de erros
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });
  
  // Rota de registro corrigida
  app.post('/api/register', authenticateToken, express.json(), async (req, res) => {
    try {
      console.log('Recebida requisição para cadastrar analista');
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);
      console.log('User:', req.user);
  
      // Verifica se é admin
      if (!req.user || req.user.username !== 'admin') {
        console.log('Acesso negado - usuário não é admin');
        return res.status(403).json({ 
          success: false,
          error: 'Acesso negado: somente administradores podem cadastrar novos analistas'
        });
      }
  
      const { name, username, password } = req.body;
  
      // Validação robusta
      if (!name || !username || !password) {
        console.log('Validação falhou - campos obrigatórios');
        return res.status(400).json({
          success: false,
          error: 'Todos os campos são obrigatórios',
          missing: {
            name: !name,
            username: !username,
            password: !password
          }
        });
      }
  
      if (password.length < 6) {
        console.log('Validação falhou - senha muito curta');
        return res.status(400).json({
          success: false,
          error: 'A senha deve ter no mínimo 6 caracteres'
        });
      }
  
      // Verifica se usuário já existe
      const agentExists = await new Promise((resolve, reject) => {
        db.get("SELECT id FROM agents WHERE username = ?", [username], (err, row) => {
          if (err) {
            console.error('Erro ao verificar usuário existente:', err);
            reject(err);
          } else {
            resolve(!!row);
          }
        });
      });
  
      if (agentExists) {
        console.log('Usuário já existe:', username);
        return res.status(409).json({
          success: false,
          error: 'Nome de usuário já está em uso'
        });
      }
  
      // Criptografa a senha
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Senha criptografada com sucesso');
  
      // Insere no banco de dados
      const result = await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO agents (name, username, password) VALUES (?, ?, ?)",
          [name, username, hashedPassword],
          function(err) {
            if (err) {
              console.error('Erro ao inserir no banco de dados:', err);
              reject(err);
            } else {
              console.log('Analista cadastrado com ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      });
  
      // Resposta de sucesso
      res.status(201).json({
        success: true,
        message: 'Analista cadastrado com sucesso',
        data: {
          id: result.id,
          name,
          username
        }
      });
  
    } catch (err) {
      console.error('Erro no processo de cadastro:', err);
      res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        // Mostra detalhes apenas em desenvolvimento
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });
  // Configuração do Socket.io
io.on('connection', (socket) => {
    console.log(`Novo cliente conectado: ${socket.id}`);
  
    // Conexão do usuário
    socket.on('client_message', (data) => {
      console.log(`Mensagem recebida do usuário ${socket.id}:`, data.text);
      
      const chatId = socket.id;
  
      // Salva no banco de dados
      db.run(
        "INSERT INTO messages (chat_id, sender, text) VALUES (?, ?, ?)",
        [chatId, 'user', data.text],
        (err) => {
          if (err) return console.error('Erro ao salvar mensagem:', err);
          
          // Atualiza/insere chat ativo
          db.run(
            `INSERT OR REPLACE INTO active_chats (chat_id, user_id, status) 
             VALUES (?, ?, 'waiting')`,
            [chatId, chatId],
            (err) => {
              if (err) return console.error('Erro ao atualizar chat ativo:', err);
              
              // Envia para todos os analistas conectados
              io.to('analistas').emit('new_message', {
                chatId,
                sender: 'user',
                text: data.text,
                timestamp: new Date().toISOString()
              });
              
              console.log(`Mensagem enviada para analistas: ${data.text}`);
            }
          );
        }
      );
    });
  
    // Conexão do analista
    socket.on('agent_connected', (agentId) => {
      console.log(`Analista conectado: ${agentId}`);
      socket.join('analistas');
      socket.agentId = agentId;
      
      // Atualiza status no banco de dados
      db.run(
        "UPDATE agents SET status = 'available' WHERE id = ?",
        [agentId]
      );
      
      // Atribui chats pendentes
      assignChats();
    });
  
    // Analista envia mensagem
    socket.on('agent_message', (data) => {
      console.log(`Mensagem do analista ${socket.agentId} para chat ${data.chatId}:`, data.text);
      
      db.run(
        "INSERT INTO messages (chat_id, sender, text) VALUES (?, ?, ?)",
        [data.chatId, 'agent', data.text],
        (err) => {
          if (err) return console.error('Erro ao salvar mensagem do analista:', err);
          
          // Envia para o usuário específico
          io.to(data.chatId).emit('new_message', {
            sender: 'agent',
            text: data.text,
            timestamp: new Date().toISOString()
          });
        }
      );
    });
  
    // Desconexão
    socket.on('disconnect', () => {
      console.log(`Cliente desconectado: ${socket.id}`);
      if (socket.agentId) {
        db.run(
          "UPDATE agents SET status = 'offline' WHERE id = ?",
          [socket.agentId]
        );
      }
    });
  });
  
  function assignChats() {
    db.all(
      "SELECT chat_id FROM active_chats WHERE status = 'waiting'",
      (err, rows) => {
        if (err) return console.error('Erro ao buscar chats pendentes:', err);
        
        rows.forEach(row => {
          db.run(
            "UPDATE active_chats SET status = 'in_progress' WHERE chat_id = ?",
            [row.chat_id],
            (err) => {
              if (err) return console.error('Erro ao atualizar status do chat:', err);
              
              io.to('analistas').emit('chat_assigned', {
                chatId: row.chat_id
              });
            }
          );
        });
      }
    );
  }
  // Rota para obter histórico de mensagens
app.get('/api/messages', (req, res) => {
    const { chatId } = req.query;
    
    db.all(
      "SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp",
      [chatId],
      (err, messages) => {
        if (err) {
          console.error('Erro ao buscar mensagens:', err);
          return res.status(500).json({ error: 'Erro ao carregar mensagens' });
        }
        res.json(messages);
      }
    );
  });