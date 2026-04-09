import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var dbService: DatabaseService

    var body: some View {
        Group {
            if authVM.isLoggedIn {
                MainTabView()
            } else {
                PortalHubView()
            }
        }
        .animation(.easeInOut, value: authVM.isLoggedIn)
        .onChange(of: dbService.isConnected) { _, connected in
            if connected {
                authVM.retryAutoLoginIfNeeded()
            }
        }
    }
}
