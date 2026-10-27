// One message: the editor while it is a draft, the sending report once it is sent.
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorNote, Loading, useLoad } from '../ui.jsx';
import Compose from './Compose.jsx';
import Report from './Report.jsx';

export default function Message() {
  const { id } = useParams();
  const message = useLoad(() => api.get(`/api/campaigns/${id}`), [id]);
  if (message.error) return <ErrorNote error={message.error} onRetry={message.reload} />;
  if (!message.data) return <Loading />;
  return message.data.status === 'draft'
    ? <Compose key={id} message={message.data} onSent={message.reload} />
    : <Report key={id} message={message.data} reload={message.reload} />;
}
