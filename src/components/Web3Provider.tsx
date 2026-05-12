'use client';

import React from 'react';
import { Web3ReactProvider } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';

function getLibrary(provider: any): Web3Provider {
  const library = new Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
}

interface Web3ProviderProps {
  children: React.ReactNode;
}

const Web3ProviderWrapper: React.FC<Web3ProviderProps> = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      {children}
    </Web3ReactProvider>
  );
};

export default Web3ProviderWrapper;