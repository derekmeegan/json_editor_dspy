import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Home } from 'lucide-react';

const Navbar: React.FC = () => {
  const location = useLocation();

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-2">
            <FileText className="text-blue-600 h-6 w-6" />
            <h1 className="text-xl font-semibold">JSON Editor</h1>
          </div>
          
          <nav className="flex space-x-6">
            <NavLink to="/" active={location.pathname === '/'}>
              <Home className="h-5 w-5 mr-1" />
              <span>Dashboard</span>
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
};

interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, active, children }) => {
  return (
    <Link
      to={to}
      className={`flex items-center ${
        active 
          ? 'text-blue-600 border-b-2 border-blue-600' 
          : 'text-gray-600 hover:text-blue-600 transition-colors'
      }`}
    >
      {children}
    </Link>
  );
};

export default Navbar;