const API_URL = "https://agendamento-preventivo-api.onrender.com";
const SENHA_CORRETA = "3012";
const SENHA_ADMIN = "3012";
let horariosAdmin = [];
let extrasAdmin = [];
let vagasAdmin = {}; // vagas por horário

// ==================== AGENDAMENTO ====================

async function agendar() {
  const nome = document.getElementById("nome").value.trim();
  const telefone = document.getElementById("telefone").value.trim();
  const hora = document.getElementById("hora").value;
  const dataAgendamento = document.getElementById("dataAgendamento").value;
  const ultimop = document.getElementById("ultimop").value.trim();
  const ama = document.getElementById("ama").value.trim();

  if (!nome || !telefone || !hora || !dataAgendamento || !ultimop || !ama) {
    alert("Preencha todos os campos e selecione um horário!");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/agendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, telefone, hora, datanasc: dataAgendamento, ultimop, ama })
    });

    const data = await response.json();

    if (response.ok) {
      alert("✅ Agendamento salvo com sucesso!");
      limparCampos();
    } else {
      alert("❌ " + (data.erro || "Erro ao agendar!"));
    }
  } catch (err) {
    alert("❌ Erro ao conectar ao servidor!");
    console.error(err);
  }
}

function limparCampos() {
  document.getElementById("nome").value = "";
  document.getElementById("telefone").value = "";
  document.getElementById("hora").value = "";
  document.getElementById("ama").value = "";
  document.getElementById("ultimop").value = "";
  document.getElementById("gradeHorarios").innerHTML = '<p class="vazio">Selecione uma data primeiro.</p>';

  // Limpa o Flatpickr corretamente
  const fp = document.getElementById("dataAgendamento")._flatpickr;
  if (fp) fp.clear();
}

// ==================== HORÁRIOS ====================

function gerarHorariosPadrao() {
  const horarios = [];
  for (let h = 7; h <= 16; h++) {
    horarios.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 16) horarios.push(`${String(h).padStart(2, "0")}:30`);
  }
  return horarios;
}

async function carregarHorarios() {
  const data = document.getElementById("dataAgendamento").value;
  const grade = document.getElementById("gradeHorarios");

  document.getElementById("hora").value = "";

  if (!data) return;

  const diaSemana = new Date(data + "T00:00:00").getDay();
  if (diaSemana === 0 || diaSemana === 6) {
    grade.innerHTML = '<p style="color:red;">⚠️ Atendimento apenas em dias úteis!</p>';
    return;
  }

  grade.innerHTML = '<p class="vazio">Carregando horários...</p>';

  try {
    const [resConfig, resOcupados] = await Promise.all([
      fetch(`${API_URL}/configuracao/${data}`),
      fetch(`${API_URL}/horarios/${data}`)
    ]);

    const config = await resConfig.json();
    const ocupados = await resOcupados.json();

    const bloqueados = config.bloqueados || [];
    const extras = config.extras || [];

    const padrao = gerarHorariosPadrao();
    const disponiveis = [
      ...padrao.filter(h => !bloqueados.includes(h)),
      ...extras
    ].sort();

    if (disponiveis.length === 0) {
      grade.innerHTML = '<p style="color:red;">⚠️ Nenhum horário disponível para este dia.</p>';
      return;
    }

    grade.innerHTML = "";

    disponiveis.forEach(h => {
      const btn = document.createElement("button");
      btn.textContent = h;
      btn.classList.add("btn-horario");
      btn.type = "button";

      if (ocupados.includes(h)) {
        btn.classList.add("ocupado");
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => selecionarHorario(h, btn));
      }

      grade.appendChild(btn);
    });

  } catch (err) {
    grade.innerHTML = '<p style="color:red;">Erro ao carregar horários.</p>';
    console.error(err);
  }
}

function selecionarHorario(horario, btn) {
  document.querySelectorAll(".btn-horario.selecionado")
    .forEach(b => b.classList.remove("selecionado"));

  btn.classList.add("selecionado");
  document.getElementById("hora").value = horario;
}

// ==================== CALENDÁRIO AGENDAMENTO ====================

async function iniciarCalendario() {
  try {
    const response = await fetch(`${API_URL}/datas-disponiveis`);
    const datas = await response.json();

    // ✅ Destrói instância antiga se existir
    const inputEl = document.getElementById("dataAgendamento");
    if (inputEl._flatpickr) inputEl._flatpickr.destroy();

    flatpickr("#dataAgendamento", {
      locale: "pt",
      dateFormat: "Y-m-d",
      minDate: "today",
      enable: datas,
      disableMobile: true,
      onDayCreate: function (dObj, dStr, fp, dayElem) {
        const data = dayElem.dateObj;
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");
        const dataFormatada = `${ano}-${mes}-${dia}`;

        console.log("Verificando:", dataFormatada, "Incluído:", datas.includes(dataFormatada));

        if (datas.includes(dataFormatada)) {
          dayElem.classList.add("dia-disponivel");
        }
      },
      onChange: function () {
        carregarHorarios();
      }
    });

  } catch (err) {
    console.error("Erro ao carregar datas:", err);
  }
}

iniciarCalendario();

// ==================== MODAL VER AGENDAMENTOS ====================

function abrirModal() {
  document.getElementById("modal").style.display = "flex";
  document.getElementById("senhaInput").value = "";
  document.getElementById("erroSenha").style.display = "none";
}

function fecharModal() {
  document.getElementById("modal").style.display = "none";
}

function verificarSenha() {
  const senha = document.getElementById("senhaInput").value;

  if (senha === SENHA_CORRETA) {
    fecharModal();
    document.getElementById("cardAgendamentos").style.display = "block";
    iniciarCalendarioFiltro();
  } else {
    document.getElementById("erroSenha").style.display = "block";
  }
}

function fecharAgendamentos() {
  document.getElementById("cardAgendamentos").style.display = "none";
}

document.getElementById("senhaInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") verificarSenha();
});

// ==================== CALENDÁRIO FILTRO ====================

let filtroIniciado = false;

function iniciarCalendarioFiltro() {
  if (filtroIniciado) return; // evita iniciar duas vezes
  filtroIniciado = true;

  flatpickr("#dataFiltro", {
    locale: "pt",
    dateFormat: "Y-m-d",
    disableMobile: true,
    onChange: async function (selectedDates, dateStr) {
      await carregarAgendamentosPorData(dateStr);
    }
  });
}

// ==================== LISTA DE AGENDAMENTOS ====================

async function carregarAgendamentosPorData(data) {
  const listaAgendamento = document.getElementById("listaAgendamento");
  listaAgendamento.innerHTML = '<p class="vazio">Carregando...</p>';

  try {
    const response = await fetch(`${API_URL}/agendamentos/${data}`);
    const lista = await response.json();

    listaAgendamento.innerHTML = "";

    if (lista.length === 0) {
      listaAgendamento.innerHTML = '<p class="vazio">Nenhum agendamento nesta data.</p>';
      return;
    }

    lista.forEach(ag => {
      const item = document.createElement("div");
      item.classList.add("item-agendamento");
      item.innerHTML = `
        <p><strong>Hora:</strong> ${ag.hora}</p>
        <p><strong>Nome:</strong> ${ag.nome}</p>
        <p><strong>AMA:</strong> ${ag.ama || "-"}</p>
        <p><strong>Telefone:</strong> ${ag.telefone}</p>
        <p><strong>Último preventivo:</strong> ${ag.ultimop}</p>
      `;
      listaAgendamento.appendChild(item);
    });
  } catch (err) {
    listaAgendamento.innerHTML = '<p style="color:red;">Erro ao carregar.</p>';
  }
}

function formatarData(data) {
  if (!data) return "-";
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ==================== ADMIN ====================

function abrirAdmin() {
  const senha = prompt("Digite a senha de administrador:");
  if (senha !== SENHA_ADMIN) {
    alert("❌ Senha incorreta!");
    return;
  }
  document.querySelector(".navbar").style.display = "none"; // ← esconde
  document.getElementById("modalAdmin").style.display = "flex";
  document.getElementById("statusDia").style.display = "none";
  document.getElementById("dataAdmin").value = "";
  horariosAdmin = [];
  extrasAdmin = [];
}

function fecharAdmin() {
  document.querySelector(".navbar").style.display = "flex"; // ← mostra
  document.getElementById("modalAdmin").style.display = "none";
}

async function carregarConfiguracao() {
  const data = document.getElementById("dataAdmin").value;
  const statusDia = document.getElementById("statusDia");
  const avisoFimSemana = document.getElementById("avisoFimSemana");
  const horariosDiv = document.getElementById("horariosAdmin");

  if (!data) return;

  const diaSemana = new Date(data + "T00:00:00").getDay();
  statusDia.style.display = "block";

  if (diaSemana === 0 || diaSemana === 6) {
    avisoFimSemana.style.display = "block";
    horariosDiv.innerHTML = "";
    return;
  }

  avisoFimSemana.style.display = "none";

  try {
    const response = await fetch(`${API_URL}/configuracao/${data}`);
    const config = await response.json();

    horariosAdmin = config.bloqueados ? [...config.bloqueados] : [];
    extrasAdmin = config.extras ? [...config.extras] : [];

    const padrao = gerarHorariosPadrao();
    horariosDiv.innerHTML = "";

    padrao.forEach(h => {
      const btn = document.createElement("button");
      btn.textContent = h;
      btn.classList.add("btn-horario");
      btn.type = "button";

      if (horariosAdmin.includes(h)) {
        btn.classList.add("ocupado");
        btn.title = "Bloqueado — clique para reabrir";
      } else {
        btn.classList.add("liberado");
        btn.title = "Aberto — clique para bloquear";
      }

      btn.addEventListener("click", () => toggleBloqueio(h, btn));
      horariosDiv.appendChild(btn);
    });

    renderizarExtras();

  } catch (err) {
    alert("Erro ao carregar configuração!");
    console.error(err);
  }

  const padrao = gerarHorariosPadrao();
  horariosDiv.innerHTML = "";

  padrao.forEach(h => {
    const vagas = vagasAdmin[h] || 1;

    const wrapper = document.createElement("div");
    wrapper.classList.add("horario-admin-item");

    const btn = document.createElement("button");
    btn.textContent = h;
    btn.classList.add("btn-horario");
    btn.type = "button";

    if (horariosAdmin.includes(h)) {
      btn.classList.add("ocupado");
    } else {
      btn.classList.add("liberado");
    }

    btn.addEventListener("click", () => toggleBloqueio(h, btn));

    const inputVagas = document.createElement("input");
    inputVagas.type = "number";
    inputVagas.min = "1";
    inputVagas.max = "10";
    inputVagas.value = vagas;
    inputVagas.classList.add("input-vagas");
    inputVagas.title = "Vagas disponíveis";
    inputVagas.addEventListener("change", () => {
      vagasAdmin[h] = parseInt(inputVagas.value) || 1;
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(inputVagas);
    horariosDiv.appendChild(wrapper);
  });

}

function toggleBloqueio(horario, btn) {
  if (horariosAdmin.includes(horario)) {
    horariosAdmin = horariosAdmin.filter(h => h !== horario);
    btn.classList.remove("ocupado");
    btn.classList.add("liberado");
    btn.title = "Aberto — clique para bloquear";
  } else {
    horariosAdmin.push(horario);
    btn.classList.remove("liberado");
    btn.classList.add("ocupado");
    btn.title = "Bloqueado — clique para reabrir";
  }
}

function adicionarExtra() {
  const input = document.getElementById("horarioExtra");
  const horario = input.value;

  if (!horario) {
    alert("Selecione um horário!");
    return;
  }

  const padrao = gerarHorariosPadrao();
  if (padrao.includes(horario)) {
    alert("Esse horário já está no padrão! Desbloqueie-o em vez de adicionar.");
    return;
  }

  if (extrasAdmin.includes(horario)) {
    alert("Esse horário extra já foi adicionado!");
    return;
  }

  extrasAdmin.push(horario);
  input.value = "";
  renderizarExtras();
}

function renderizarExtras() {
  const listaExtras = document.getElementById("listaExtras");
  listaExtras.innerHTML = "";

  if (extrasAdmin.length === 0) {
    listaExtras.innerHTML = '<p class="vazio" style="grid-column:span 4;">Nenhum horário extra adicionado.</p>';
    return;
  }

  extrasAdmin.sort().forEach(h => {
    const vagas = vagasAdmin[h] || 1;

    const wrapper = document.createElement("div");
    wrapper.classList.add("horario-admin-item");

    const btn = document.createElement("button");
    btn.textContent = `${h} ✕`;
    btn.classList.add("btn-horario", "liberado");
    btn.type = "button";
    btn.title = "Clique para remover";
    btn.addEventListener("click", () => removerExtra(h));

    const inputVagas = document.createElement("input");
    inputVagas.type = "number";
    inputVagas.min = "1";
    inputVagas.max = "10";
    inputVagas.value = vagas;
    inputVagas.classList.add("input-vagas");
    inputVagas.title = "Vagas disponíveis";
    inputVagas.addEventListener("change", () => {
      vagasAdmin[h] = parseInt(inputVagas.value) || 1;
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(inputVagas);
    listaExtras.appendChild(wrapper);
  });
}

function removerExtra(horario) {
  extrasAdmin = extrasAdmin.filter(h => h !== horario);
  renderizarExtras();
}

async function salvarConfiguracao() {
  const data = document.getElementById("dataAdmin").value;

  if (!data) {
    alert("Selecione uma data!");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/configuracao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, bloqueados: horariosAdmin, extras: extrasAdmin, vagas: vagasAdmin })
    });

    const result = await response.json();

    if (response.ok) {
      alert("✅ Configuração salva com sucesso!");
      fecharAdmin();
      iniciarCalendario(); // atualiza o calendário com a nova data
    } else {
      alert("❌ Erro: " + result.erro);
    }
  } catch (err) {
    alert("❌ Erro ao salvar configuração!");
    console.error(err);
  }
}