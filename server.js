// IMPORTS
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import multer from "multer";
import cloudinary from "cloudinary";
import crypto from "crypto";

dotenv.config();

// CLOUDINARY CONFIG
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
});

// APP INIT
const app = express();
app.use(cors());
app.use(express.json());

// MONGOOSE CONNECT
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Error al conectar MongoDB", err));

// MULTER
const storage = multer.memoryStorage();
const upload = multer({ storage });

// TOKEN SYSTEM
const tokensActivos = [];
function crearToken() {
  return crypto.randomBytes(20).toString("hex");
}

// PRODUCT SCHEMA
const ProductoSchema = new mongoose.Schema({
  nombre: String,
  precio: String,
  categoria: String,
  imagen: String,
  estado: String,
  descripcion: String,
  imagenes_extra: [String]
});

const Producto = mongoose.model("Producto", ProductoSchema);

// AUTH MIDDLEWARE
function auth(req, res, next) {
  const token = req.headers["authorization"];
  if (!token || !tokensActivos.includes(token)) {
    return res.status(403).json({ error: "No autorizado" });
  }
  next();
}

// LOGIN
app.post("/login", (req, res) => {
  if (req.body.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  const token = crearToken();
  tokensActivos.push(token);

  res.json({ token });
});

// GET ALL
app.get("/productos", async (req, res) => {
  const productos = await Producto.find();
  res.json(productos);
});

// GET ONE
app.get("/productos/:id", async (req, res) => {
  const p = await Producto.findById(req.params.id);
  if (!p) return res.status(404).json({ error: "No encontrado" });
  res.json(p);
});

// CREATE PRODUCT
app.post("/productos", auth, async (req, res) => {
  const nuevo = new Producto({
    nombre: req.body.nombre,
    precio: req.body.precio,
    categoria: req.body.categoria,
    imagen: req.body.imagen,
    estado: req.body.estado,
    descripcion: req.body.descripcion || "",
    imagenes_extra: req.body.imagenes_extra || []
  });

  await nuevo.save();
  res.json({ mensaje: "Producto agregado", producto: nuevo });
});

// UPDATE PRODUCT
app.put("/productos/:id", auth, async (req, res) => {
  const producto = await Producto.findByIdAndUpdate(
    req.params.id,
    {
      nombre: req.body.nombre,
      precio: req.body.precio,
      categoria: req.body.categoria,
      imagen: req.body.imagen,
      estado: req.body.estado,
      descripcion: req.body.descripcion,
      imagenes_extra: req.body.imagenes_extra || []
    },
    { new: true }
  );

  if (!producto) return res.status(404).json({ error: "No encontrado" });

  res.json({ mensaje: "Producto actualizado", producto });
});

// DELETE PRODUCT
app.delete("/productos/:id", auth, async (req, res) => {
  await Producto.findByIdAndDelete(req.params.id);
  res.json({ mensaje: "Producto eliminado" });
});

// UPLOAD IMAGE
app.post("/upload", auth, upload.single("imagen"), async (req, res) => {
  try {
    cloudinary.v2.uploader.upload_stream(
      { folder: "bodega-el-milagro" },
      (error, result) => {
        if (error) return res.status(500).json({ error: "Error Cloudinary" });
        res.json({ url: result.secure_url });
      }
    ).end(req.file.buffer);
  } catch (e) {
    res.status(500).json({ error: "Error inesperado" });
  }
});

// RUN SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Servidor corriendo en puerto " + PORT)
);
