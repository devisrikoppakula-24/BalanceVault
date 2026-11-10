import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    const response = await api.get('/api/admin/users');
    setUsers(response.data.users || []);
  };

  useEffect(() => {
    loadUsers().catch(() => setError('Unable to load admin data.'));
  }, []);

  const summary = useMemo(() => {
    const totalBalance = users.reduce((sum, current) => sum + (current.accounts || []).reduce((accountSum, account) => accountSum + Number(account.balance || 0), 0), 0);
    const pendingAccounts = users.reduce((sum, current) => sum + (current.accounts || []).filter((account) => account.status === 'PENDING').length, 0);
    return { totalBalance, pendingAccounts, memberCount: users.length };
  }, [users]);

  const handleApprove = async (accountId) => {
    setError('');
    try {
      await api.post(`/api/admin/accounts/${accountId}/approve`);
      await loadUsers();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Approval failed.');
    }
  };

  return (
    <div className="admin-page page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin workspace</p>
          <h1>Operational oversight</h1>
        </div>
        <button type="button" onClick={logout} className="button secondary">Logout</button>
      </header>

      <div className="summary-grid three-columns">
        <div className="card stat-card accent">
          <span>Total members</span>
          <strong>{summary.memberCount}</strong>
        </div>
        <div className="card stat-card">
          <span>Portfolio value</span>
          <strong>${summary.totalBalance.toLocaleString()}</strong>
        </div>
        <div className="card stat-card">
          <span>Pending accounts</span>
          <strong>{summary.pendingAccounts}</strong>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="card panel">
        <h2>Onboarding queue</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Account</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.flatMap((userEntry) =>
                (userEntry.accounts || []).map((account) => (
                  <tr key={account.id}>
                    <td>{userEntry.name}</td>
                    <td>{userEntry.email}</td>
                    <td>{account.name}</td>
                    <td><span className={`status ${account.status.toLowerCase()}`}>{account.status}</span></td>
                    <td>${Number(account.balance).toLocaleString()}</td>
                    <td>
                      {account.status === 'PENDING' ? (
                        <button type="button" className="button small" onClick={() => handleApprove(account.id)}>
                          Approve
                        </button>
                      ) : (
                        <span>Approved</span>
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
