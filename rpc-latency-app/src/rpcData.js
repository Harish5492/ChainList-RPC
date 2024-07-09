import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RpcData = () => {
  const [rpcData, setRpcData] = useState([]);
  const [rpcname, setRpcName] = useState("");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [intervalId, setIntervalId] = useState(null);

  const fetchRpcData = async (isInitialFetch = false) => {
    if (!id) return;
    if (isInitialFetch) setLoading(true);
    try {
      const response = await axios.get(`http://localhost:5000/rpcbychainId/${id}`);
      setRpcData(response.data.rpcData);
      setRpcName(response.data.name);
    } catch (error) {
      console.error('Error fetching RPC data:', error);
    } finally {
      if (isInitialFetch) setLoading(false);
    }
  };

  const startFetchingRpcData = (event) => {
    event.preventDefault();
    fetchRpcData(true);
    if (intervalId) clearInterval(intervalId);
    const newIntervalId = setInterval(() => fetchRpcData(false), 2000);
    setIntervalId(newIntervalId);
  };

  useEffect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalId]);

  return (
    <div className='d-flex justify-content-center align-items-center flex-column m-2 p-2 bg-grey'>
      <h2>RPC Data</h2>
      <form onSubmit={startFetchingRpcData}>
        <label className='m-2 p-2'>
          Enter the Chain id
        </label>
        <input 
          type='number' 
          value={id}
          onChange={(e) => setId(e.target.value)}
        /> 
        <button type='submit' disabled={!id}>
          Enter
        </button>
      </form>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className='mb-3 mt-5'>
            <h5>{rpcname ? `${rpcname} RPC URL LIST` : 'No RPC Data Available'}</h5>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">RPC Server Address</th>
                <th scope="col">Height</th>
                <th scope="col">Latency</th>
              </tr>
            </thead>
            <tbody>
              {rpcData.length ? (
                rpcData.map((rpc, index) => (
                  <tr key={index}>
                    <th scope="row">{rpc.url}</th>
                    <td>{rpc.height}</td>
                    <td>{rpc.latency} ms</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default RpcData;
