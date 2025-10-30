import express from "express";
import cors from "cors";

import routes from "./rutas/index.js";
import { rutasServidor } from "./configuracion/rutas.js";

const app = express();

// Aqui preparo Express para entender JSON sin que el cliente tenga que hacer malabares.
app.use(express.json());
app.use(cors());

// Comparto la carpeta de uploads porque necesito ofrecer las fotos directamente.
app.use("/uploads", express.static(rutasServidor.uploads));

// Montamos todas las rutas de la API.
app.use(routes);

export default app;
