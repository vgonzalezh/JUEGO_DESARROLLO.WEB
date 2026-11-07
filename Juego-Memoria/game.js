"use strict";
/*
 * Memoria Embrujada: memorama de 2 jugadores con 13 pares y 2 telarañas (28 cartas).
 * Regla B: cada 4 pares encontrados se intercambian dos cartas boca abajo.
 * Regla C: la telaraña no suma, congela el próximo turno y pone el fondo rojo.
 * Al terminar: se destapan todas las cartas, sale un mensaje con confeti y suena una fanfarria.
 * No hay asincronismo: tras un fallo se pulsa "Siguiente turno" en lugar de usar temporizadores.
 */

// Variables 
const PARES_TOTALES = 13;
const PARES_PARA_GANAR = 7;
const JUGADAS_PARA_MEZCLAR = 4;
let turnoActual = 0;
let parejasEncontradas = 0;
let jugadasExitosas = 0;
let esperandoSiguiente = false;   // bloquea el tablero tras un fallo o una telaraña
let juegoTerminado = false;
let musicaActiva = false;         // true cuando la música de fondo está sonando

// Arreglos: catálogo de pares, mazo lógico, referencias a botones y cartas volteadas en el turno
const CATALOGO = [
  { id: 1,  nombre: "Fantasmita",        archivo: "img/01.jpg" },
  { id: 2,  nombre: "Muñeca de botones", archivo: "img/02.jpg" },
  { id: 3,  nombre: "Gusano gruñón",     archivo: "img/03.jpg" },
  { id: 4,  nombre: "Trío travieso",     archivo: "img/04.jpg" },
  { id: 5,  nombre: "Santa esqueleto",   archivo: "img/05.jpg" },
  { id: 6,  nombre: "Bola de nieve",     archivo: "img/06.jpg" },
  { id: 7,  nombre: "Medallón del sol",  archivo: "img/07.jpg" },
  { id: 8,  nombre: "Muñeca remendada",  archivo: "img/08.jpg" },
  { id: 9,  nombre: "Hechizo",           archivo: "img/09.jpg" },
  { id: 10, nombre: "Té de locos",       archivo: "img/10.jpg" },
  { id: 11, nombre: "Reina roja",        archivo: "img/11.jpg" },
  { id: 12, nombre: "Ojo cosido",        archivo: "img/12.jpg" },
  { id: 13, nombre: "Casa embrujada",    archivo: "img/13.jpg" }
];
let cartas = [];
let botones = [];
let volteadas = [];
let ultimoCambio = [];

// Objetos literales: la telaraña, los jugadores y las referencias al DOM
const TRAMPA = { id: 0, nombre: "Telaraña" };
const jugadores = [
  { nombre: "Jugador 1", puntos: 0, congelada: false },
  { nombre: "Jugador 2", puntos: 0, congelada: false }
];
const ui = {
  tablero: document.getElementById("tablero"),
  mensaje: document.getElementById("mensaje"),
  turno: document.getElementById("turno"),
  mezcla: document.getElementById("mezcla"),
  siguiente: document.getElementById("siguiente"),
  reiniciar: document.getElementById("reiniciar"),
  paneles: [document.getElementById("panel0"), document.getElementById("panel1")],
  nombres: [document.getElementById("nombre0"), document.getElementById("nombre1")],
  puntos: [document.getElementById("puntos0"), document.getElementById("puntos1")],
  estados: [document.getElementById("estado0"), document.getElementById("estado1")],
  // Pantalla de inicio, música, mensaje de victoria y confeti
  portada: document.getElementById("portada"),
  iniciar: document.getElementById("iniciar"),
  musica: document.getElementById("botonMusica"),
  audio: document.getElementById("musica"),
  victoria: document.getElementById("victoria"),
  victoriaTitulo: document.getElementById("victoriaTitulo"),
  victoriaTexto: document.getElementById("victoriaTexto"),
  otraPartida: document.getElementById("otraPartida"),
  confeti: document.getElementById("confeti")
};

// Arreglos: colores del confeti y notas de la fanfarria (cada nota es un objeto literal)
const COLORES_CONFETI = ["#f472b6", "#fb923c", "#facc15", "#a78bfa", "#34d399", "#60a5fa"];
const FANFARRIA = [
  { notas: [523.25],                       inicio: 0,    duracion: 0.12 },   // ti
  { notas: [659.25],                       inicio: 0.12, duracion: 0.12 },   // ri
  { notas: [783.99],                       inicio: 0.24, duracion: 0.12 },   // rin
  { notas: [1046.5],                       inicio: 0.36, duracion: 0.25 },
  { notas: [392, 523.25, 659.25],          inicio: 0.7,  duracion: 0.2 },    // tan
  { notas: [523.25, 659.25, 783.99, 1046.5], inicio: 1.0, duracion: 0.7 }    // taaan
];
let contextoAudio = null;

// Funciones flecha: número al azar y creación del mazo barajado (cada carta es un objeto)
const azar = max => Math.floor(Math.random() * max);

const crearMazo = () => {
  const base = [...CATALOGO, ...CATALOGO, TRAMPA, TRAMPA];
  return base
    .map(c => ({
      id: c.id, nombre: c.nombre, archivo: c.archivo || "",
      trampa: c.id === TRAMPA.id, volteada: false, emparejada: false, duena: -1
    }))
    .map(carta => ({ carta, sorteo: Math.random() }))
    .sort((a, b) => a.sorteo - b.sorteo)
    .map(item => item.carta);
};

// Manipulación del DOM: los botones se crean elemento por elemento con createElement
function crearBoton(indice) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "carta";
  boton.setAttribute("aria-label", "Carta " + (indice + 1));
  const interior = document.createElement("div");
  interior.className = "interior";
  const dorso = document.createElement("div");
  dorso.className = "dorso";
  const frente = document.createElement("div");
  frente.className = "frente";
  interior.append(dorso, frente);
  boton.appendChild(interior);
  // Eventos: clic en cada carta
  boton.addEventListener("click", () => elegirCarta(indice));
  return boton;
}

// El contenido de una carta solo se escribe en el DOM cuando se voltea
function mostrarCarta(indice) {
  const carta = cartas[indice];
  const frente = botones[indice].querySelector(".frente");
  frente.replaceChildren();
  frente.classList.toggle("trampa", carta.trampa);
  if (carta.trampa) {
    frente.textContent = carta.nombre;
  } else {
    const imagen = document.createElement("img");
    imagen.src = carta.archivo;
    imagen.alt = carta.nombre;
    frente.appendChild(imagen);
  }
  botones[indice].classList.add("volteada");
}

// Dibuja el tablero completo desde el arreglo lógico (al iniciar y tras la mezcla)
function renderTablero() {
  ui.tablero.replaceChildren();
  botones = cartas.map((carta, indice) => {
    const boton = crearBoton(indice);
    ui.tablero.appendChild(boton);
    return boton;
  });
  cartas.forEach((carta, indice) => {
    if (carta.emparejada) {
      mostrarCarta(indice);
      botones[indice].classList.add("emparejada", "j" + carta.duena);
    }
    botones[indice].classList.toggle("barajada", ultimoCambio.includes(indice));
  });
}

function actualizarInterfaz() {
  const mayor = jugadores[0].puntos > jugadores[1].puntos ? 0 : 1;
  jugadores.forEach((jugador, i) => {
    ui.puntos[i].textContent = jugador.puntos;
    ui.paneles[i].classList.toggle("activa", i === turnoActual && !juegoTerminado);
    ui.paneles[i].classList.toggle("ganadora", juegoTerminado && i === mayor);
    ui.paneles[i].classList.toggle("perdedora", juegoTerminado && i !== mayor);
    // Condiciones: el texto de estado depende de la situación de cada jugador
    if (juegoTerminado) {
      ui.estados[i].textContent = i === mayor ? "Ganador" : "Perdió";
    } else if (jugador.congelada) {
      ui.estados[i].textContent = "Congelada";
    } else if (jugador.puntos >= PARES_PARA_GANAR) {
      ui.estados[i].textContent = "Victoria asegurada";
    } else if (i === turnoActual && !juegoTerminado) {
      ui.estados[i].textContent = "Su turno";
    } else {
      ui.estados[i].textContent = "";
    }
  });
  ui.turno.textContent = juegoTerminado ? "Partida terminada" : "Turno de " + jugadores[turnoActual].nombre;
  ui.mezcla.textContent = "Mezcla en " + (JUGADAS_PARA_MEZCLAR - jugadasExitosas % JUGADAS_PARA_MEZCLAR) + " pares";
  ui.siguiente.disabled = !esperandoSiguiente || juegoTerminado;
  // Al terminar el juego las cartas ya no se pueden pulsar
  ui.tablero.classList.toggle("terminado", juegoTerminado);
  // Regla C: fondo rojo mientras haya un jugador congelado
  document.body.classList.toggle("alerta-roja", jugadores.some(j => j.congelada));
}

// Regla B: intercambia dos cartas boca abajo en el arreglo lógico y repinta el DOM
function mezclarCartas() {
  const libres = cartas.map((c, i) => i).filter(i => !cartas[i].emparejada && !cartas[i].volteada);
  if (libres.length < 2) {
    return false;
  }
  const a = libres[azar(libres.length)];
  const distintas = libres.filter(i => cartas[i].id !== cartas[a].id);
  if (distintas.length === 0) {
    return false;
  }
  const b = distintas[azar(distintas.length)];
  const temporal = cartas[a];
  cartas[a] = cartas[b];
  cartas[b] = temporal;
  ultimoCambio = [a, b];
  renderTablero();
  return true;
}

// Regla C: si el siguiente jugador está congelado, pierde su turno y vuelve a jugar el anterior
function pasarTurno(avisos) {
  turnoActual = turnoActual === 0 ? 1 : 0;
  if (jugadores[turnoActual].congelada) {
    jugadores[turnoActual].congelada = false;
    avisos.push(jugadores[turnoActual].nombre + " pierde este turno.");
    pasarTurno(avisos);
  }
}

// Al terminar: destapa las cartas que faltan (las telarañas) para que se vean todas
function revelarTodas() {
  cartas.forEach((carta, indice) => {
    if (!carta.volteada && !carta.emparejada) {
      mostrarCarta(indice);
      botones[indice].classList.add("revelada");
    }
  });
}

// Sonido: la fanfarria se crea con osciladores del navegador (no hay archivos ni red)
function tocarFanfarria() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) {
    return;
  }
  if (!contextoAudio) {
    contextoAudio = new Contexto();
  }
  const base = contextoAudio.currentTime + 0.05;
  FANFARRIA.forEach(golpe => {
    golpe.notas.forEach(frecuencia => {
      const oscilador = contextoAudio.createOscillator();
      const volumen = contextoAudio.createGain();
      oscilador.type = "triangle";
      oscilador.frequency.value = frecuencia;
      volumen.gain.setValueAtTime(0.12, base + golpe.inicio);
      volumen.gain.exponentialRampToValueAtTime(0.001, base + golpe.inicio + golpe.duracion);
      oscilador.connect(volumen);
      volumen.connect(contextoAudio.destination);
      oscilador.start(base + golpe.inicio);
      oscilador.stop(base + golpe.inicio + golpe.duracion + 0.05);
    });
  });
}

// Confeti: cada pieza es un <span> que cae con CSS y se borra solo cuando termina su animación
function lanzarConfeti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  for (let i = 0; i < 90; i++) {
    const pieza = document.createElement("span");
    pieza.className = "confeti";
    pieza.style.left = azar(100) + "vw";
    pieza.style.background = COLORES_CONFETI[azar(COLORES_CONFETI.length)];
    pieza.style.animationDuration = (3 + Math.random() * 2) + "s";
    pieza.style.animationDelay = (Math.random() * 1.2) + "s";
    pieza.style.setProperty("--dx", (azar(30) - 15) + "vw");
    pieza.addEventListener("animationend", () => pieza.remove());
    ui.confeti.appendChild(pieza);
  }
}

function mostrarVictoria(ganadora) {
  ui.victoriaTitulo.textContent = "¡Gana " + ganadora.nombre + "!";
  ui.victoriaTexto.textContent = "Encontró " + ganadora.puntos + " pares";
  ui.victoria.classList.remove("oculta");
  lanzarConfeti();
  tocarFanfarria();
}

function finalizarPartida(avisos) {
  juegoTerminado = true;
  jugadores.forEach(j => { j.congelada = false; });
  const ganadora = jugadores[0].puntos > jugadores[1].puntos ? jugadores[0] : jugadores[1];
  avisos.push("Gana " + ganadora.nombre + " con " + ganadora.puntos + " pares");
  revelarTodas();
  mostrarVictoria(ganadora);
}

// Se ejecuta cuando hay dos cartas volteadas en el turno
function resolverPareja(avisos) {
  const [a, b] = volteadas;
  const jugador = jugadores[turnoActual];
  if (cartas[a].id === cartas[b].id) {
    [a, b].forEach(i => {
      cartas[i].emparejada = true;
      cartas[i].duena = turnoActual;
      botones[i].classList.add("emparejada", "j" + turnoActual);
    });
    volteadas = [];
    jugador.puntos++;
    parejasEncontradas++;
    jugadasExitosas++;
    avisos.push("Pareja de " + jugador.nombre + ". Sigue jugando.");
    if (parejasEncontradas === PARES_TOTALES) {
      finalizarPartida(avisos);
    } else if (jugadasExitosas % JUGADAS_PARA_MEZCLAR === 0 && mezclarCartas()) {
      avisos.push("Se mezclaron dos cartas.");
    }
  } else {
    esperandoSiguiente = true;
    avisos.push("No coinciden.");
  }
}

function elegirCarta(indice) {
  const carta = cartas[indice];
  if (juegoTerminado || esperandoSiguiente || carta.volteada || carta.emparejada) {
    return;
  }
  const avisos = [];
  carta.volteada = true;
  volteadas.push(indice);
  mostrarCarta(indice);

  if (carta.trampa) {
    // Regla C: no suma, termina el turno y congela el siguiente del jugador activo
    jugadores[turnoActual].congelada = true;
    esperandoSiguiente = true;
    avisos.push("Telaraña: " + jugadores[turnoActual].nombre + " pierde su próximo turno.");
  } else if (volteadas.length === 2) {
    resolverPareja(avisos);
  }
  ui.mensaje.textContent = avisos.join(" ");
  actualizarInterfaz();
}

function siguienteTurno() {
  if (!esperandoSiguiente || juegoTerminado) {
    return;
  }
  volteadas.forEach(i => {
    cartas[i].volteada = false;
    botones[i].classList.remove("volteada");
  });
  volteadas = [];
  esperandoSiguiente = false;
  const avisos = [];
  pasarTurno(avisos);
  ui.mensaje.textContent = avisos.join(" ");
  actualizarInterfaz();
}

function iniciarPartida() {
  turnoActual = 0;
  parejasEncontradas = 0;
  jugadasExitosas = 0;
  esperandoSiguiente = false;
  juegoTerminado = false;
  volteadas = [];
  ultimoCambio = [];
  jugadores.forEach(j => { j.puntos = 0; j.congelada = false; });
  ui.victoria.classList.add("oculta");
  ui.confeti.replaceChildren();
  cartas = crearMazo();
  renderTablero();
  ui.mensaje.textContent = "Voltea dos cartas por turno.";
  actualizarInterfaz();
}

// Música de fondo: el icono la pone o la quita
function actualizarBotonMusica() {
  ui.musica.textContent = musicaActiva ? "🔊" : "🔇";
  ui.musica.title = musicaActiva ? "Quitar música (M)" : "Poner música (M)";
  ui.musica.setAttribute("aria-label", ui.musica.title);
}

function alternarMusica() {
  if (musicaActiva) {
    ui.audio.pause();
  } else {
    ui.audio.play();
  }
  musicaActiva = !musicaActiva;
  actualizarBotonMusica();
}

// Eventos del navegador: clic en botones, escritura en los nombres y teclado
ui.siguiente.addEventListener("click", siguienteTurno);
ui.reiniciar.addEventListener("click", iniciarPartida);
ui.otraPartida.addEventListener("click", iniciarPartida);
ui.musica.addEventListener("click", alternarMusica);

// Pantalla de inicio: al pulsar "Iniciar a jugar" se oculta y arranca la música
ui.iniciar.addEventListener("click", () => {
  ui.portada.classList.add("oculta");
  ui.audio.volume = 0.35;
  ui.audio.play();
  musicaActiva = true;
  actualizarBotonMusica();
});

ui.nombres.forEach((campo, i) => {
  campo.addEventListener("input", () => {
    jugadores[i].nombre = campo.value.trim() || "Jugador " + (i + 1);
    actualizarInterfaz();
  });
});

document.addEventListener("keydown", evento => {
  // No usar atajos mientras se escribe un nombre o se ve la pantalla de inicio
  if (evento.target.tagName === "INPUT" || !ui.portada.classList.contains("oculta")) {
    return;
  }
  const tecla = evento.key.toLowerCase();
  if (tecla === "n") {
    siguienteTurno();
  } else if (tecla === "r") {
    iniciarPartida();
  } else if (tecla === "m") {
    alternarMusica();
  }
});

iniciarPartida();
actualizarBotonMusica();
