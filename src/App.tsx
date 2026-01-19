import { Routes, Route } from 'react-router-dom';
import HomePage from './mobile/pages/Home';
import ListPage from './mobile/pages/List';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:listId" element={<ListPage />} />
    </Routes>
  );
}
