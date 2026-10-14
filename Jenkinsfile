pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 20, unit: 'MINUTES')
    }

    // Webhook (instant, needs a public URL) with polling as the fallback
    triggers {
        githubPush()
        pollSCM('H/2 * * * *')
    }

    environment {
        COMPOSE_PROJECT_NAME = 'ticket-system'   // stable network/container names across builds
        TAG = "${env.BUILD_NUMBER}"              // image: ticket-app/web:<build#>
        APP_PORT = '8080'
        // VITE_FIREBASE_* come from Jenkins global environment variables (jenkins/casc.yaml)
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Check Config') {
            // Fail fast: without these the build would "succeed" but the app would be unusable
            steps {
                sh '''
                    missing=""
                    for v in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_FIREBASE_APP_ID; do
                      if [ -z "$(printenv "$v")" ]; then echo "Missing $v"; missing=1; fi
                    done
                    [ -z "$missing" ] || { echo "Set the VITE_FIREBASE_* values in jenkins/.env and restart Jenkins"; exit 1; }
                    echo "Firebase config present"
                '''
            }
        }

        stage('Lint') {
            // Quality gate: fails the pipeline if `npm run lint` fails inside the Docker "lint" stage
            steps {
                sh 'docker build --target lint .'
            }
        }

        stage('Build Image') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose up -d --remove-orphans'
            }
        }

        stage('Smoke Test') {
            // Run from inside the container: Jenkins can't reach the host's published port
            steps {
                sh '''
                    for i in $(seq 1 20); do
                      if docker compose exec -T web wget -qO- http://127.0.0.1/healthz | grep -q OK; then
                        echo "web health: OK"; break
                      fi
                      [ "$i" -eq 20 ] && { echo "web never became healthy"; exit 1; }
                      sleep 3
                    done
                    docker compose exec -T web wget -qO- http://127.0.0.1/ | grep -qi "IT Ticketing"
                    docker compose exec -T web wget -qO- http://127.0.0.1/tickets/123 | grep -qi "IT Ticketing"
                    docker compose exec -T web grep -rqF "${VITE_FIREBASE_PROJECT_ID}" /usr/share/nginx/html/assets
                    echo "Smoke tests passed"
                '''
            }
        }
    }

    post {
        success {
            echo "Deployed build #${env.BUILD_NUMBER} at http://localhost:${env.APP_PORT}"
        }
        failure {
            sh 'docker compose ps || true'
            sh 'docker compose logs --tail=50 || true'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
