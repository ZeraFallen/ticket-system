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
        COMPOSE_PROJECT_NAME = 'ticket-system'   // stable network/volume names across builds
        TAG = "${env.BUILD_NUMBER}"              // images: ticket-app/<svc>:<build#>
        APP_PORT = '8080'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Unit Tests') {
            // Fails the pipeline if `npm test` fails inside the api "test" stage
            steps {
                sh 'docker build --target test -t ticket-app/api-test:${TAG} ./api'
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([
                    string(credentialsId: 'ticket-db-root-password', variable: 'DB_ROOT_PASSWORD'),
                    string(credentialsId: 'ticket-db-password',      variable: 'DB_PASSWORD')
                ]) {
                    sh 'docker compose up -d --remove-orphans'
                }
            }
        }

        stage('Smoke Test') {
            steps {
                // Run from inside the proxy container: Jenkins can't reach the host's :8080
                sh '''
                    for i in $(seq 1 20); do
                      if docker compose exec -T proxy wget -qO- http://127.0.0.1/api/health | grep -q OK; then
                        echo "API health: OK"; break
                      fi
                      [ "$i" -eq 20 ] && { echo "API never became healthy"; exit 1; }
                      sleep 3
                    done
                    docker compose exec -T proxy wget -qO- http://127.0.0.1/api/tickets | grep -q title
                    docker compose exec -T proxy wget -qO- http://127.0.0.1/ | grep -qi "Helpdesk"
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
