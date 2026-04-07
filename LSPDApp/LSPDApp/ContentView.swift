import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        Group {
            if authVM.isLoggedIn {
                MainTabView()
            } else {
                PortalHubView()
            }
        }
        .animation(.easeInOut, value: authVM.isLoggedIn)
    }
}
