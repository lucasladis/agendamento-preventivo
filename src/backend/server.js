require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

//! Conexão ao mongo

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Conectado ao banco de dados com sucesso!");
    console.log("Conectado em:", mongoose.connection.name);
  } catch (error) {
    console.error("Erro ao conectar ao banco de dados:".error);
  }
}

connectMongo();

//* Modelo de agendamento com request no site

const Agendamento = mongoose.model("Agendamento", {
  ubs: String,
  nome: String,
  telefone: String,
  hora: String,
  datanasc: String,       // data do agendamento
  ama: String,
  ultimop: String,
  criadoEm: { type: Date, default: Date.now }
});

//? Criação de rota

app.post("/agendar", async (req, res) => {
  try {
    const { nome, ama, datanasc } = req.body;

    // Verifica se já existe agendamento com mesmo nome ou AMA naquele dia
    const jaExiste = await Agendamento.findOne({
      datanasc,
      $or: [
        { nome: nome.toUpperCase() },
        { ama: ama.toUpperCase() }
      ]
    });

    if (jaExiste) {
      return res.status(400).json({
        erro: "Já existe um agendamento para este paciente nesta data!"
      });
    }

    const agendamento = new Agendamento(req.body);
    await agendamento.save();
    res.status(201).json({ message: "Agendamento Salvo com Sucesso!" });

  } catch (error) {
    res.status(500).json({ erro: "Erro ao agendar" });
  }
});

//? Rota para ver oa agendamentos

app.get("/agendamentos", async (req, res) => {
  try {
    const lista = await Agendamento.find().sort({ criadoEm: -1 });
    res.json(lista);
  } catch (err) {
    console.error("Erro completo:", err); // ← adicione essa linha
    res.status(500).json({ erro: err.message }); // ← mostre o erro real
  }
});

//? ROTA PARA HORARIOS  

app.get("/horarios/:data", async (req,res) => {
  try {
    const agendamentos = await Agendamento.find( { datanasc: req.params.data } );
    const config = await Configuracao.findOne({ data: req.params.data });

    // conta quantos agendamentos tem por hora

    const contagem = {};
    agendamentos.forEach(a => {
      contagem[a.hora] = (contagem[a.hora] || 0) + 1;
    });

    // verifica os horarios que estão cheios

    const ocupados = [];
    for (const [hora, count] of Object.entries(contagem)) {
      const vagas = config?.vagas?.get(hora) || 1;
      if (count >= 1) ocupados.push(hora);
    }
  }

  catch(error) {
    res.status(500).json({ error: err.message })
  }
})

const Configuracao = mongoose.model("Configuracao", {
  data: String,
  bloqueados: [String],
  extras: [String],
  vagas: { type: Map, of: Number, default: {}} // Ex: 07:00: 2
});

// Buscar configuração de um dia
app.get("/configuracao/:data", async (req, res) => {
  try {
    const config = await Configuracao.findOne({ data: req.params.data });
    res.json({
      bloqueados: config ? config.bloqueados : [],
      extras: config ? config.extras : []
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Salvar configuração de um dia
app.post("/configuracao", async (req, res) => {
  try {
    const { data, bloqueados, extras, vagas } = req.body;
    await Configuracao.findOneAndUpdate(
      { data },
      { bloqueados, extras, vagas },
      { upsert: true, returnDocument: "after" }
    );
    res.json({ message: "Configuração salva com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get("/datas-disponiveis", async (req, res) => {
  try {
    const configs = await Configuracao.find();
    // Retorna apenas datas que não estão totalmente bloqueadas
    const datas = configs
      .filter(c => {
        const padrao = 18; // total de horários padrão (7h-16h de 30 em 30)
        return c.bloqueados.length < padrao || c.extras.length > 0;
      })
      .map(c => c.data);
    res.json(datas);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get("/agendamentos/:data", async (req, res) => {
  try {
    const lista = await Agendamento.find({
      datanasc: req.params.data
    }).sort({ hora: 1 });
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


//! final

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});






