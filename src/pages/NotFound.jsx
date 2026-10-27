import { Link } from 'react-router-dom';
import { Empty } from '../ui.jsx';

export default function NotFound() {
  return (
    <Empty title="Page not found" action={<Link className="button" to="/">Go to the overview</Link>}>
      There’s nothing at this address.
    </Empty>
  );
}
