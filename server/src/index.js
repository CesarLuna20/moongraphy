import app from "./app.js";
import { ajustesEntorno } from "./configuracion/entorno.js";
import { conectarBaseDatos } from "./database/conexion.js";
import { asegurarAdministradorInicial } from "./servicios/usuarios.js";
import { asegurarPlantillasPredeterminadas } from "./servicios/plantillas.js";
import { asegurarPoliticaCancelacionPredeterminada } from "./servicios/politicas.js";
import { iniciarProgramadorRecordatorios } from "./tareas/recordatorios.js";

// Arranco el servidor y dejo todo listo antes de aceptar peticiones.
const iniciarServidor = async () => {
  try {
    await conectarBaseDatos();

    // Cargo datos iniciales indispensables.
    await asegurarAdministradorInicial();
    await asegurarPlantillasPredeterminadas();
    await asegurarPoliticaCancelacionPredeterminada();

    iniciarProgramadorRecordatorios();

    app.listen(ajustesEntorno.puerto, () => {
      console.log(`[servidor] API lista en http://localhost:${ajustesEntorno.puerto}`);
    });
  } catch (error) {
    console.error("[servidor] No pude iniciar el servidor", error);
    process.exit(1);
  }
};

iniciarServidor();
