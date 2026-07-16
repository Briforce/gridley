import { Grid } from './components/grid'
import type { GridColumnDef } from './components/grid'
import './App.css'

interface Person {
  id: number
  name: string
  age: number
  email: string
  city: string
  score: number
}

const FIRST_NAMES = [
  'Ada', 'Grace', 'Alan', 'Edsger', 'Barbara', 'Donald', 'Margaret', 'Linus',
  'Katherine', 'Dennis', 'Radia', 'Ken', 'Frances', 'John', 'Hedy', 'Claude',
]
const LAST_NAMES = [
  'Lovelace', 'Hopper', 'Turing', 'Dijkstra', 'Liskov', 'Knuth', 'Hamilton',
  'Torvalds', 'Johnson', 'Ritchie', 'Perlman', 'Thompson', 'Allen', 'Backus',
]
const CITIES = [
  'Amsterdam', 'Boston', 'Chicago', 'Denver', 'Edinburgh', 'Fukuoka',
  'Geneva', 'Helsinki', 'Istanbul', 'Jakarta', 'Kyoto', 'Lisbon',
]

function generatePeople(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST_NAMES[(i * 7) % FIRST_NAMES.length]
    const last = LAST_NAMES[(i * 13) % LAST_NAMES.length]
    return {
      id: i + 1,
      name: `${first} ${last}`,
      age: 18 + ((i * 31) % 62),
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      city: CITIES[(i * 17) % CITIES.length],
      score: ((i * 37) % 1000) / 10,
    }
  })
}

const people = generatePeople(10_000)

const columnDefs: GridColumnDef<Person>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'name' },
  { field: 'age', width: 90 },
  { field: 'email', width: 280 },
  { field: 'city', width: 130 },
  {
    field: 'score',
    width: 100,
    valueFormatter: (value) => Number(value).toFixed(1),
  },
]

function App() {
  return (
    <main className="demo">
      <h1>Gridley</h1>
      <p className="demo-note">10,000 rows — virtualized</p>
      <Grid<Person> rowData={people} columnDefs={columnDefs} height={480} />
    </main>
  )
}

export default App
