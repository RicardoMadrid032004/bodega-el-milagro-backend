// IMPORTS
import express from "express";
import fs from "fs";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import cloudinary from "cloudinary";
import multer from "multer";

dotenv.config();

// CONFIG CLOUDINARY + MULTER
const storage = multer.memoryStorage();
const upload = multer({ storage });

cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_SECRET
});

// APP INIT
const app = express();
app.use(cors());
app.use(express.json());

// VARIABLES
const RUTA_JSON = "./productos.json";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TOKEN_SECRETO = process.env.TOKEN_SECRETO;

// Crear token
function crearToken() {
  return crypto.randomBytes(20).toString("hex");
}

// Guardar tokens válidos temporalmente
let tokensActivos = [];

// LOGIN
app.post("/login", (req, res) => {
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  const token = crearToken();
  tokensActivos.push(token);

  res.json({ token });
});

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers["authorization"];

  if (!token || !tokensActivos.includes(token)) {
    return res.status(403).json({ error: "No autorizado" });
  }

  next();
}

// =======================
// HELPERS JSON
// =======================
function leerProductos() {
  const data = JSON.parse(fs.readFileSync(RUTA_JSON));
  return data.productos || [];
}

function guardarProductos(lista) {
  fs.writeFileSync(RUTA_JSON, JSON.stringify({ productos: lista }, null, 2));
}

// =======================
// GET productos
// =======================
app.get("/productos", (req, res) => {
  res.json(leerProductos());
});

// GET producto por ID
app.get("/productos/:id", (req, res) => {
  const productos = leerProductos();
  const producto = productos.find(p => p.id === req.params.id);

  if (!producto) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  res.json(producto);
});

// =======================
// POST productos
// =======================
app.post("/productos", authMiddleware, (req, res) => {
  const productos = leerProductos();

  const nuevo = {
    id: Date.now().toString(),
    nombre: req.body.nombre,
    precio: req.body.precio,
    categoria: req.body.categoria,
    imagen: req.body.imagen,
    estado: req.body.estado,
    descripcion: req.body.descripcion || "",
    imagenes_extra: req.body.imagenes_extra || []
  };

  productos.push(nuevo);
  guardarProductos(productos);

  res.json({ mensaje: "Producto agregado", producto: nuevo });
});

// =======================
// PUT productos
// =======================
app.put("/productos/:id", authMiddleware, (req, res) => {
  let productos = leerProductos();
  const id = req.params.id;

  const index = productos.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  const productoAnterior = productos[index];

  // ⭐ ACTUALIZACIÓN CORRECTA
  productos[index] = {
    ...productoAnterior,
    nombre: req.body.nombre,
    precio: req.body.precio,
    categoria: req.body.categoria,
    imagen: req.body.imagen,
    estado: req.body.estado,
    descripcion: req.body.descripcion,

    // ⭐⭐ ESTA ES LA PARTE IMPORTANTE:
    imagenes_extra: req.body.imagenes_extra || []
  };

  guardarProductos(productos);
  res.json({ mensaje: "Producto actualizado correctamente", producto: productos[index] });
});


// =======================
// DELETE productos
// =======================
app.delete("/productos/:id", authMiddleware, (req, res) => {
  let productos = leerProductos();

  productos = productos.filter(p => p.id !== req.params.id);
  guardarProductos(productos);

  res.json({ mensaje: "Producto eliminado" });
});

// =======================
// UPLOAD imagen
// =======================
app.post("/upload", upload.single("imagen"), authMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ninguna imagen" });
    }

    cloudinary.v2.uploader.upload_stream(
      { folder: "bodega-el-milagro" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary error:", error);
          return res.status(500).json({ error: "Error al subir imagen" });
        }
        res.json({ url: result.secure_url });
      }
    ).end(req.file.buffer);

  } catch (error) {
    console.error("Error inesperado:", error);
    res.status(500).json({ error: "Error inesperado" });
  }
});

// =======================
// RUN SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor Bodega El Milagro funcionando en el puerto " + PORT);
});
