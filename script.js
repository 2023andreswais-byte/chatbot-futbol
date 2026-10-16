
"use strict";

// Elementos de la página.
const zonaChat = document.getElementById("zona-chat");
const zonaOpciones = document.getElementById("zona-opciones");
const nombreUsuario = document.getElementById("nombre-usuario");
const botonReiniciar = document.getElementById("boton-reiniciar-lateral");

// Estado del chatbot.
let arbol = null;
let nombre = "";
let nodoActual = "";
let conversacionTerminada = false;

// ==================================================
// 1. CARGAR Y VALIDAR EL ÁRBOL DE DECISIONES
// ==================================================

async function cargarArbol() {
    zonaChat.replaceChildren();
    zonaOpciones.replaceChildren();

    try {
        const respuesta = await fetch("./arbol_decision.json");

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar arbol_decision.json");
        }

        const datos = await respuesta.json();

        validarArbol(datos);
        arbol = datos;

        mostrarNodo("inicio");
    } catch (error) {
        console.error("Error al iniciar el chatbot:", error);

        zonaChat.replaceChildren();
        zonaOpciones.replaceChildren();

        agregarMensaje(
            "bot",
            "Abrí el proyecto con Live Server o un servidor local para que pueda leer arbol_decision.json"
        );
    }
}

function validarArbol(datos) {
    if (!datos || !Array.isArray(datos.nodos)) {
        throw new Error("El archivo JSON no contiene una lista de nodos.");
    }

    const identificadores = new Set();

    // Primero comprobamos que todos los nodos sean válidos.
    for (const nodo of datos.nodos) {
        if (
            typeof nodo.id !== "string" ||
            typeof nodo.texto !== "string" ||
            !Array.isArray(nodo.opciones)
        ) {
            throw new Error("Hay un nodo con datos incorrectos.");
        }

        if (identificadores.has(nodo.id)) {
            throw new Error("Hay identificadores de nodos repetidos.");
        }

        identificadores.add(nodo.id);
    }

    if (!identificadores.has("inicio")) {
        throw new Error("Falta el nodo inicial.");
    }

    // Estas opciones son acciones, no identificadores de nodos.
    const acciones = new Set(["terminar", "reiniciar"]);

    // Después comprobamos los destinos de todos los botones.
    for (const nodo of datos.nodos) {
        for (const opcion of nodo.opciones) {
            if (
                typeof opcion.texto !== "string" ||
                typeof opcion.siguiente !== "string"
            ) {
                throw new Error("Hay una opción incompleta.");
            }

            if (
                !identificadores.has(opcion.siguiente) &&
                !acciones.has(opcion.siguiente)
            ) {
                throw new Error(
                    `Destino inexistente: ${opcion.siguiente}`
                );
            }
        }
    }
}

// ==================================================
// 2. MENSAJES DEL CHAT
// ==================================================

function agregarMensaje(tipo, texto) {
    const mensaje = document.createElement("div");
    mensaje.className = `mensaje ${tipo}`;

    const avatar = document.createElement("div");
    avatar.className = "mini-avatar";
    avatar.textContent = tipo === "bot" ? "⚽" : "👤";
    avatar.setAttribute("aria-hidden", "true");

    const burbuja = document.createElement("div");
    burbuja.className = "burbuja";
    burbuja.textContent = texto;

    mensaje.append(avatar, burbuja);
    zonaChat.appendChild(mensaje);

    zonaChat.scrollTop = zonaChat.scrollHeight;
}

function personalizarTexto(texto) {
    return texto.replaceAll("{{nombre}}", nombre || "futbolero");
}

function buscarNodo(id) {
    return arbol.nodos.find(nodo => nodo.id === id);
}

// ==================================================
// 3. MOSTRAR NODOS Y SUS OPCIONES
// ==================================================

function mostrarNodo(id, mostrarEleccion = false, textoEleccion = "") {
    if (!arbol || conversacionTerminada) {
        return;
    }

    const nodo = buscarNodo(id);

    if (!nodo) {
        agregarMensaje(
            "bot",
            "No se encontró esa opción. Podés volver al menú principal."
        );

        mostrarNavegacion();
        return;
    }

    nodoActual = id;

    if (mostrarEleccion) {
        agregarMensaje("usuario", textoEleccion);
    }

    agregarMensaje("bot", personalizarTexto(nodo.texto));
    zonaOpciones.replaceChildren();

    // Cada tipo de nodo tiene su formulario correspondiente.
    switch (nodo.tipo) {
        case "nombre":
            mostrarFormularioNombre();
            return;

        case "consulta":
            mostrarFormularioConsulta();
            return;

        case "equipo":
            mostrarFormularioDato(
                "equipo",
                "Escribí el nombre del equipo",
                "Buscar equipo",
                responderEquipo
            );
            return;

        case "jugador":
            mostrarFormularioDato(
                "jugador",
                "Escribí el nombre del jugador",
                "Buscar jugador",
                responderJugador
            );
            return;

        case "seleccion":
            mostrarFormularioDato(
                "seleccion",
                "Escribí el nombre del país",
                "Buscar selección",
                responderSeleccion
            );
            return;

        case "partido":
            mostrarFormularioFecha();
            return;

        default:
            crearBotones(nodo.opciones);
    }
}

function crearBotones(opciones) {
    zonaOpciones.replaceChildren();

    opciones.forEach((opcion, indice) => {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.className =
            indice === 0
                ? "boton-opcion principal"
                : "boton-opcion";

        boton.textContent = opcion.texto;

        boton.addEventListener("click", () => {
            if (conversacionTerminada) return;

            if (opcion.siguiente === "terminar") {
                finalizarConversacion();
                return;
            }

            if (opcion.siguiente === "reiniciar") {
                reiniciarConversacion();
                return;
            }

            mostrarNodo(
                opcion.siguiente,
                true,
                opcion.texto
            );
        });

        zonaOpciones.appendChild(boton);
    });
}

// ==================================================
// 4. FORMULARIO PARA INGRESAR EL NOMBRE
// ==================================================

function mostrarFormularioNombre() {
    const formulario = document.createElement("form");
    formulario.className = "formulario-chat";

    const campo = document.createElement("input");
    campo.type = "text";
    campo.id = "campo-nombre";
    campo.name = "nombre";
    campo.className = "campo";
    campo.placeholder = "Tu nombre...";
    campo.autocomplete = "given-name";
    campo.maxLength = 50;
    campo.required = true;
    campo.setAttribute("aria-label", "Tu nombre");

    const error = document.createElement("p");
    error.className = "mensaje-error";
    error.setAttribute("role", "alert");

    const boton = document.createElement("button");
    boton.type = "submit";
    boton.className = "boton-opcion principal";
    boton.textContent = "Comenzar";

    formulario.append(campo, error, boton);
    zonaOpciones.appendChild(formulario);

    campo.focus();

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();

        const valor = campo.value.trim();

        if (
            valor.length < 2 ||
            !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(valor)
        ) {
            error.textContent =
                "Ingresá un nombre válido, sin números ni símbolos.";
            campo.focus();
            return;
        }

        nombre = valor;
        nombreUsuario.textContent = nombre;

        agregarMensaje("usuario", nombre);

        // Ir directamente al menú principal después del saludo.
        mostrarNodo("menu_principal");
    });
}

// ==================================================
// 5. FORMULARIO PARA ESCRIBIR PREGUNTAS
// ==================================================

function mostrarFormularioConsulta() {
    const formulario = document.createElement("form");
    formulario.className = "formulario-chat";

    const campo = document.createElement("input");
    campo.type = "text";
    campo.id = "campo-pregunta";
    campo.name = "pregunta";
    campo.className = "campo";
    campo.placeholder = "Escribí tu pregunta sobre fútbol...";
    campo.autocomplete = "off";
    campo.maxLength = 180;
    campo.required = true;
    campo.setAttribute(
        "aria-label",
        "Escribí tu pregunta sobre fútbol"
    );

    const error = document.createElement("p");
    error.className = "mensaje-error";
    error.setAttribute("role", "alert");

    const boton = document.createElement("button");
    boton.type = "submit";
    boton.className = "boton-opcion principal";
    boton.textContent = "⚽ Consultar";

    formulario.append(campo, error, boton);
    zonaOpciones.appendChild(formulario);

    // El campo queda visible y listo para escribir.
    campo.focus();

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();

        if (conversacionTerminada) return;

        const pregunta = campo.value.trim();

        if (pregunta.length < 4) {
            error.textContent =
                "Escribí una pregunta de al menos 4 caracteres.";
            campo.focus();
            return;
        }

        agregarMensaje("usuario", pregunta);

        const respuesta = responderPregunta(pregunta);

        mostrarResultado(respuesta);
    });
}

// ==================================================
// 6. FORMULARIOS PARA EQUIPOS, JUGADORES Y SELECCIONES
// ==================================================

function mostrarFormularioDato(tipo, textoCampo, textoBoton, responder) {
    const formulario = document.createElement("form");
    formulario.className = "formulario-chat";

    const campo = document.createElement("input");
    campo.type = "text";
    campo.name = tipo;
    campo.className = "campo";
    campo.placeholder = textoCampo;
    campo.maxLength = 80;
    campo.required = true;
    campo.autocomplete = "off";

    const error = document.createElement("p");
    error.className = "mensaje-error";
    error.setAttribute("role", "alert");

    const boton = document.createElement("button");
    boton.type = "submit";
    boton.className = "boton-opcion principal";
    boton.textContent = textoBoton;

    formulario.append(campo, error, boton);
    zonaOpciones.appendChild(formulario);

    campo.focus();

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();

        const valor = campo.value.trim();

        if (
            valor.length < 2 ||
            !/^[\p{L}\p{M}0-9 .,'’()-]+$/u.test(valor)
        ) {
            error.textContent = "Ingresá un nombre válido.";
            campo.focus();
            return;
        }

        agregarMensaje("usuario", valor);
        mostrarResultado(responder(valor));
    });
}

function mostrarFormularioFecha() {
    const formulario = document.createElement("form");
    formulario.className = "formulario-chat";

    const campo = document.createElement("input");
    campo.type = "date";
    campo.name = "fecha";
    campo.className = "campo";
    campo.required = true;

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");

    campo.min = `${anio}-${mes}-${dia}`;

    const error = document.createElement("p");
    error.className = "mensaje-error";
    error.setAttribute("role", "alert");

    const boton = document.createElement("button");
    boton.type = "submit";
    boton.className = "boton-opcion principal";
    boton.textContent = "Consultar fecha";

    formulario.append(campo, error, boton);
    zonaOpciones.appendChild(formulario);

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();

        if (!campo.value) {
            error.textContent = "Seleccioná una fecha válida.";
            return;
        }

        const fecha = new Date(`${campo.value}T12:00:00`);

        agregarMensaje(
            "usuario",
            fecha.toLocaleDateString("es-AR")
        );

        mostrarResultado(
            "Todavía no tengo un calendario actualizado de partidos. " +
            "Sin una fuente de datos en tiempo real no puedo confirmar " +
            "los encuentros ni sus horarios para esa fecha."
        );
    });
}

// ==================================================
// 7. RESPUESTAS INFORMATIVAS LOCALES
// ==================================================

function normalizar(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

const equipos = {
    "boca juniors":
        "Boca Juniors es un club argentino de Buenos Aires. Su estadio histórico es La Bombonera.",

    "river plate":
        "River Plate es un club argentino de Buenos Aires. Su estadio es el Monumental.",

    "real madrid":
        "Real Madrid es un club español con una extensa historia en competiciones nacionales e internacionales.",

    "barcelona":
        "El FC Barcelona es un club español conocido por su historia y su trabajo de formación de futbolistas.",

    "manchester city":
        "Manchester City es un club inglés que compite en la Premier League.",

    "inter miami":
        "Inter Miami es un club estadounidense que compite en la Major League Soccer."
};

const jugadores = {
    "lionel messi":
        "Lionel Messi es un futbolista argentino nacido el 24 de junio de 1987. Ganó el Mundial de 2022 con Argentina.",

    "cristiano ronaldo":
        "Cristiano Ronaldo es un futbolista portugués nacido el 5 de febrero de 1985. Es reconocido por su capacidad goleadora.",

    "diego maradona":
        "Diego Maradona fue un futbolista argentino y una de las figuras principales de la selección campeona del Mundial de 1986.",

    "kylian mbappe":
        "Kylian Mbappé es un futbolista francés reconocido por su velocidad y su capacidad goleadora."
};

const selecciones = {
    "argentina":
        "Argentina ganó tres Mundiales masculinos: 1978, 1986 y 2022.",

    "brasil":
        "Brasil ganó cinco Mundiales masculinos: 1958, 1962, 1970, 1994 y 2002.",

    "francia":
        "Francia ganó los Mundiales masculinos de 1998 y 2018.",

    "alemania":
        "Alemania ganó cuatro Mundiales masculinos: 1954, 1974, 1990 y 2014.",

    "uruguay":
        "Uruguay ganó los Mundiales masculinos de 1930 y 1950.",

    "espana":
        "España ganó el Mundial masculino de 2010."
};

function responderEquipo(valor) {
    return equipos[normalizar(valor)] ||
        `Todavía no tengo información local sobre ${valor}. Probá con Boca Juniors, River Plate, Real Madrid, Barcelona, Manchester City o Inter Miami.`;
}

function responderJugador(valor) {
    return jugadores[normalizar(valor)] ||
        `Todavía no tengo información local sobre ${valor}. Probá con Lionel Messi, Cristiano Ronaldo, Diego Maradona o Kylian Mbappé.`;
}

function responderSeleccion(valor) {
    return selecciones[normalizar(valor)] ||
        `Todavía no tengo información local sobre la selección de ${valor}. Probá con Argentina, Brasil, Francia, Alemania, Uruguay o España.`;
}

function responderPregunta(pregunta) {
    const texto = normalizar(pregunta);

    if (texto.includes("messi")) {
        return jugadores["lionel messi"];
    }

    if (texto.includes("cristiano ronaldo")) {
        return jugadores["cristiano ronaldo"];
    }

    if (texto.includes("maradona")) {
        return jugadores["diego maradona"];
    }

    if (
        texto.includes("mundial") &&
        texto.includes("argentina")
    ) {
        return selecciones["argentina"];
    }

    if (
        texto.includes("mundial") &&
        texto.includes("brasil")
    ) {
        return selecciones["brasil"];
    }

    if (
        texto.includes("fuera de juego") ||
        texto.includes("offside")
    ) {
        return "El fuera de juego depende de la posición del jugador cuando un compañero juega el balón y de su participación en la jugada. Estar adelantado por sí solo no constituye una infracción.";
    }

    if (texto.includes("penal")) {
        return "Se sanciona un penal cuando un jugador comete dentro de su propia área una infracción que se castiga con tiro libre directo.";
    }

    if (
        texto.includes("cuanto dura") ||
        texto.includes("duracion") ||
        texto.includes("cuantos minutos")
    ) {
        return "Un partido reglamentario dura 90 minutos, divididos en dos tiempos de 45 minutos, más el tiempo añadido por el árbitro.";
    }

    if (
        texto.includes("cuantos jugadores") ||
        texto.includes("jugadores tiene")
    ) {
        return "Cada equipo comienza un partido con 11 jugadores en el campo, incluido el arquero.";
    }

    if (texto.includes("champions")) {
        return "La UEFA Champions League es una competición europea de clubes. Para conocer el calendario o los resultados actuales se necesita información actualizada.";
    }

    return "No encuentro una respuesta específica en mi base local. Podés consultar por reglas, Mundiales, equipos o jugadores. Todavía no tengo acceso a información en tiempo real.";
}

// ==================================================
// 8. RESPUESTA Y NAVEGACIÓN
// ==================================================

function mostrarResultado(texto) {
    agregarMensaje("bot", texto);
    mostrarNavegacion();
}

function mostrarNavegacion() {
    crearBotones([
        {
            texto: "🏠 Menú principal",
            siguiente: "menu_principal"
        },
        {
            texto: "↩ Volver",
            siguiente: nodoActual === "reglas"
                ? "menu_principal"
                : "menu_principal"
        },
        {
            texto: "🔄 Volver a empezar",
            siguiente: "reiniciar"
        },
        {
            texto: "⏹ Terminar conversación",
            siguiente: "terminar"
        }
    ]);
}

// ==================================================
// 9. REINICIAR O TERMINAR
// ==================================================

function finalizarConversacion() {
    conversacionTerminada = true;

    agregarMensaje(
        "bot",
        `¡Gracias por charlar conmigo${nombre ? ", " + nombre : ""}! ⚽`
    );

    zonaOpciones.replaceChildren();

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton-opcion principal";
    boton.textContent = "🔄 Volver a empezar";
    boton.addEventListener("click", reiniciarConversacion);

    zonaOpciones.appendChild(boton);
}

function reiniciarConversacion() {
    nombre = "";
    nodoActual = "";
    conversacionTerminada = false;

    nombreUsuario.textContent = "Nueva conversación";

    zonaChat.replaceChildren();
    zonaOpciones.replaceChildren();

    if (arbol) {
        mostrarNodo("inicio");
    } else {
        cargarArbol();
    }
}

botonReiniciar.addEventListener("click", reiniciarConversacion);

// Iniciar el chatbot.
cargarArbol();
