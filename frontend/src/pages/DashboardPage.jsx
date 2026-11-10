import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({
    name: '',
    type: 'CHECKING',
    initialBalance: 0,
  });
  const [ledgerForm, setLedgerForm] = useState({
    accountId: '',
    type: 'DEPOSIT',
    amount: 0,
    description: '',
  });
  const [error, setError] = useState('');

  const loadData = async () => {
    const [accountsResponse, ledgerResponse] = await Promise.all([
      api.get('/api/accounts'),
      api.get('/api/ledger'),
    ]);

    setAccounts(accountsResponse.data.accounts || []);
    setEntries(ledgerResponse.data.entries || []);

    if (accountsResponse.data.accounts?.[0]) {
      setLedgerForm((previous) => ({
        ...previous,
        accountId: accountsResponse.data.accounts[0].id,
      }));
    }
  };

  useEffect(() => {
    loadData().catch(() => setError('Unable to load dashboard data.'));
  }, []);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0),
    [accounts],
  );

  const handleAccountSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await api.post('/api/accounts', form);
      setForm({ name: '', type: 'CHECKING', initialBalance: 0 });
      await loadData();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to create account.');
    }
  };

  const handleLedgerSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await api.post('/api/ledger', {
        ...ledgerForm,
        amount: Number(ledgerForm.amount),
      });
      setLedgerForm((previous) => ({ ...previous, amount: 0, description: '' }));
      await loadData();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to process ledger entry.');
    }
  };

  return (
    <div className="dashboard-page page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Welcome, {user?.name}</h1>
        </div>
        <button type="button" onClick={logout} className="button secondary">Logout</button>
      </header>

      <div className="summary-grid">
        <div className="card stat-card accent">
          <span>Total balance</span>
          <strong>${totalBalance.toLocaleString()}</strong>
        </div>
        <div className="card stat-card">
          <span>Active accounts</span>
          <strong>{accounts.filter((account) => account.status === 'ACTIVE').length}</strong>
        </div>
        <div className="card stat-card">
          <span>Pending reviews</span>
          <strong>{accounts.filter((account) => account.status === 'PENDING').length}</strong>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="two-column-layout">
        <section className="card panel">
          <h2>Create account</h2>
          <form onSubmit={handleAccountSubmit} className="stacked-form">
            <label>
              Account name
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>

            <label>
              Type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="CHECKING">Checking</option>
                <option value="SAVINGS">Savings</option>
                <option value="INVESTMENT">Investment</option>
              </select>
            </label>

            <label>
              Initial balance
              <input type="number" min="0" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: Number(e.target.value) })} />
            </label>

            <button type="submit" className="button primary">Submit onboarding</button>
          </form>
        </section>

        <section className="card panel">
          <h2>Make ledger entry</h2>
          <form onSubmit={handleLedgerSubmit} className="stacked-form">
            <label>
              Account
              <select value={ledgerForm.accountId} onChange={(e) => setLedgerForm({ ...ledgerForm, accountId: e.target.value })}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </label>

            <label>
              Type
              <select value={ledgerForm.type} onChange={(e) => setLedgerForm({ ...ledgerForm, type: e.target.value })}>
                <option value="DEPOSIT">Deposit</option>
                <option value="WITHDRAWAL">Withdrawal</option>
              </select>
            </label>

            <label>
              Amount
              <input type="number" min="1" value={ledgerForm.amount} onChange={(e) => setLedgerForm({ ...ledgerForm, amount: Number(e.target.value) })} />
            </label>

            <label>
              Description
              <input type="text" value={ledgerForm.description} onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })} required />
            </label>

            <button type="submit" className="button primary">Post movement</button>
          </form>
        </section>
      </div>

      <section className="card panel">
        <h2>Accounts</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length ? accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{account.type}</td>
                  <td><span className={`status ${account.status.toLowerCase()}`}>{account.status}</span></td>
                  <td>${Number(account.balance).toLocaleString()}</td>
                </tr>
              )) : (
                <tr><td colSpan="4">No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card panel">
        <h2>Recent ledger</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.length ? entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.account?.name || 'Account'}</td>
                  <td>{entry.type}</td>
                  <td>${Number(entry.amount).toLocaleString()}</td>
                  <td>{entry.description}</td>
                </tr>
              )) : (
                <tr><td colSpan="4">No ledger entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
