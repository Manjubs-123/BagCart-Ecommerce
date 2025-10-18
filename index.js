import express from 'express'
import path from 'path';
import { fileURLToPath } from 'url';

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')));


const bags = [
    { id: 1, name: "Travel Backpack", price: 1999, image: "/images/bag1.jpg" },
    { id: 2, name: "Ofiice Laptop Bag", price: 2499, image: "/images/bag2.jpg" },
    { id: 3, name: "Hiking Rucksack", price: 2799, image: "/images/bag3.jpg" },

]


app.get('/', (req, res) => {
    res.render('index', { bags:bags })
})


const PORT = 3000

app.listen(PORT, () => {
    console.log("The server is running on port ", PORT)
})
