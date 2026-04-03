import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Copy, Home, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useIsCallerAdmin } from "../hooks/useQueries";

const ADMIN_USERNAME = "Admin709";
const ADMIN_PASSWORD = "Zxcvb@709";
const ADMIN_SESSION_KEY = "sk_admin_session";

export default function AdminPage() {
  const navigate = useNavigate();
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { actor, isFetching: actorLoading } = useActor();
  const { data: isAdmin, isLoading: adminLoading } = useIsCallerAdmin();

  const [setupToken, setSetupToken] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [_copied, setCopied] = useState(false);

  // Username/password login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLocalAdmin, setIsLocalAdmin] = useState(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY) === "true",
  );

  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === "logging-in";
  const isInitializing = loginStatus === "initializing";

  const principalId = identity?.getPrincipal()?.toText() ?? "";

  // Redirect to dashboard if local admin session or II admin
  useEffect(() => {
    if (isLocalAdmin) {
      navigate({ to: "/admin/dashboard" });
      return;
    }
    if (isAuthenticated && !adminLoading && !actorLoading && isAdmin === true) {
      navigate({ to: "/admin/dashboard" });
    }
  }, [
    isLocalAdmin,
    isAuthenticated,
    isAdmin,
    adminLoading,
    actorLoading,
    navigate,
  ]);

  const handleLogin = () => {
    login();
  };

  const handleLogout = () => {
    clear();
    queryClient.clear();
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsLocalAdmin(false);
  };

  const handleCopyPrincipal = () => {
    navigator.clipboard.writeText(principalId);
    setCopied(true);
    toast.success("Principal ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUsernamePasswordLogin = () => {
    setLoginError("");
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      setIsLocalAdmin(true);
      toast.success("Login successful!");
    } else {
      setLoginError("Invalid username or password.");
    }
  };

  const handleSetupAdmin = async () => {
    if (!actor || !setupToken.trim()) return;
    setIsSettingUp(true);
    try {
      await (actor as any)._initializeAccessControlWithSecret(
        setupToken.trim(),
      );
      toast.success("Admin access initialized! Verifying...");
      await queryClient.invalidateQueries({ queryKey: ["isCallerAdmin"] });
    } catch (err: any) {
      const msg = err?.message?.includes("already initialized")
        ? "Access control is already initialized. You may not have the correct token."
        : err?.message ||
          "Failed to initialize admin access. Check the token and try again.";
      toast.error(msg);
    } finally {
      setIsSettingUp(false);
    }
  };

  const isCheckingAdmin = isAuthenticated && (actorLoading || adminLoading);
  const isAccessDenied =
    isAuthenticated && !actorLoading && !adminLoading && isAdmin === false;
  const isUnregistered =
    isAuthenticated && !actorLoading && !adminLoading && isAdmin === null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="flex items-center gap-2"
            data-ocid="admin.home.link"
          >
            <div className="w-9 h-9 rounded-lg bg-saffron-500 flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg text-foreground leading-none block">
                SK Residence
              </span>
              <span className="text-[10px] text-muted-foreground tracking-wide">
                ADMIN PORTAL
              </span>
            </div>
          </button>
          {(isAuthenticated || isLocalAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              data-ocid="admin.logout_button"
            >
              Logout
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {isInitializing ? (
            <div className="text-center" data-ocid="admin.loading_state">
              <Loader2 className="w-8 h-8 animate-spin text-saffron-500 mx-auto mb-3" />
              <p className="text-muted-foreground">Initializing...</p>
            </div>
          ) : isCheckingAdmin ? (
            <div className="text-center" data-ocid="admin.loading_state">
              <Loader2 className="w-8 h-8 animate-spin text-saffron-500 mx-auto mb-3" />
              <p className="text-muted-foreground">Verifying admin access...</p>
            </div>
          ) : isUnregistered ? (
            <div
              className="bg-white rounded-2xl shadow-card p-8"
              data-ocid="admin.setup.panel"
            >
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2 text-center">
                Setup Admin Access
              </h2>
              <p className="text-muted-foreground text-sm mb-6 text-center">
                Your account has not been registered. Enter the setup token to
                initialize admin access for this portal.
              </p>
              <div className="space-y-4">
                {principalId && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">
                      Your Principal ID
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-foreground break-all flex-1">
                        {principalId}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyPrincipal}
                        className="shrink-0 p-1.5 rounded hover:bg-gray-200 transition-colors"
                        title="Copy principal ID"
                        data-ocid="admin.setup.copy_button"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Share this ID with the developer if you don&apos;t have a
                      setup token.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="setup-token">Admin Setup Token</Label>
                  <Input
                    id="setup-token"
                    type="password"
                    placeholder="Enter setup token"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetupAdmin()}
                    data-ocid="admin.setup.input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the setup token provided during deployment
                  </p>
                </div>
                <Button
                  onClick={handleSetupAdmin}
                  disabled={isSettingUp || !setupToken.trim()}
                  className="w-full bg-saffron-500 hover:bg-saffron-600 text-white font-bold"
                  data-ocid="admin.setup.primary_button"
                >
                  {isSettingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    "Initialize as Admin"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleLogout}
                  data-ocid="admin.setup.cancel_button"
                >
                  Cancel & Logout
                </Button>
              </div>
            </div>
          ) : isAccessDenied ? (
            <div
              className="text-center bg-white rounded-2xl shadow-card p-8"
              data-ocid="admin.error_state"
            >
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Access Denied
              </h2>
              <p className="text-muted-foreground text-sm mb-4">
                You are logged in but do not have admin privileges. Please
                contact the site administrator.
              </p>
              {principalId && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6 text-left">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Your Principal ID
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-foreground break-all flex-1">
                      {principalId}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyPrincipal}
                      className="shrink-0 p-1.5 rounded hover:bg-gray-200 transition-colors"
                      title="Copy principal ID"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Share this ID with the developer to get admin access.
                  </p>
                </div>
              )}
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
                data-ocid="admin.logout_button"
              >
                Logout & Try Again
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-card p-8">
              <div className="w-16 h-16 rounded-full bg-saffron-100 flex items-center justify-center mx-auto mb-5">
                <Home className="w-8 h-8 text-saffron-600" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1 text-center">
                Admin Login
              </h1>
              <p className="text-muted-foreground text-sm mb-6 text-center">
                Sign in to manage SK Residence property listings.
              </p>

              {/* Username / Password Login */}
              <div className="space-y-3 mb-5">
                <div className="space-y-1">
                  <Label htmlFor="admin-username">Username</Label>
                  <Input
                    id="admin-username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setLoginError("");
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUsernamePasswordLogin()
                    }
                    data-ocid="admin.username_input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLoginError("");
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUsernamePasswordLogin()
                    }
                    data-ocid="admin.password_input"
                  />
                </div>
                {loginError && (
                  <p className="text-sm text-red-500">{loginError}</p>
                )}
                <Button
                  onClick={handleUsernamePasswordLogin}
                  disabled={!username.trim() || !password.trim()}
                  className="w-full bg-saffron-500 hover:bg-saffron-600 text-white font-bold py-3 text-base"
                  data-ocid="admin.password_login_button"
                >
                  Login
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Internet Identity Login */}
              <Button
                onClick={handleLogin}
                disabled={isLoggingIn}
                variant="outline"
                className="w-full font-semibold"
                data-ocid="admin.primary_button"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging
                    in...
                  </>
                ) : (
                  "Login with Internet Identity"
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Secure, decentralized login powered by Internet Identity.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
